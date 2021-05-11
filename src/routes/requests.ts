import {Request, Response} from 'express';
import StatusCodes from "http-status-codes";
import {db} from "../common/database.js";
import * as apiTypes from "../common/apiTypes.js";
import * as commonTypes from "../common/commonTypes.js";
import assert from "assert";
import * as dbTypes from "../common/dbTypes.js";
import got, {Response as GotResponse} from "got";
import {RequestStatus} from "../common/commonTypes.js";
import {Unauthorized} from "../common/errors.js";
import _ from "lodash";

const { OK, UNPROCESSABLE_ENTITY } = StatusCodes;

interface DBSongRequest {
    request_id: number;
    request_type: dbTypes.RequestType;
    song_id: string;
    created_at: Date;
    num_votes: number;
}

interface RequestId {
    request_id: number;
}

async function getUserId(authHeader: string | undefined): Promise<string> {
    // validate Authorization header
    if (authHeader === undefined) {
        throw new Unauthorized("Missing authorization header");
    }
    const regexMatch = authHeader.match(/^Bearer (.*)$/);
    if (regexMatch === null) {
        throw new Unauthorized("Authorization header value does not match expected format");
    }
    const accessToken = regexMatch[1];

    // get user from access token
    const userIds = await db.select("user_id").from("users")
        .where({
            access_token: accessToken
        });
    if (userIds.length === 0) {
        throw new Unauthorized("No such access token could be found");
    }
    assert(userIds.length === 1);
    // todo: do sufficient unit testing to convince myself that it will only ever return at most one userId, then remove assertion
    return userIds[0].user_id;
}

export async function getSongRequests(req: Request, res: Response) {
    console.log("getting song requests");
    const authHeader = req.header("Authorization");
    const userId = await getUserId(authHeader);

    const adminRows = await db.select(1).from("administrators")
        .where({
            playlist_id: req.params.playlistId,
            user_id: userId
        });
    assert(adminRows.length <= 1);

    const isAdmin = adminRows.length === 1;

    const songRequests: DBSongRequest[] = await db.select(
        ["r.request_id", "r.request_type", "r.song_id", "r.created_at"]).count("v.request_id as num_votes")
        .from({r: "song_requests"}).leftJoin({v: "request_votes"}, "r.request_id", "=", "v.request_id")
        .where({
            "r.playlist_id": req.params.playlistId,
            "r.request_status": RequestStatus.Pending
        })
        .groupBy("r.request_id");

    const requestsWithYourVote: RequestId[] = await db.select(["r.request_id"])
        .from({r: "song_requests"}).leftJoin({v: "request_votes"}, "r.request_id", "=", "v.request_id")
        .where({
            "r.playlist_id": req.params.playlistId,
            "r.request_status": RequestStatus.Pending,
            "v.user_id": userId
        });
    const requestsWithYourVoteArray: number[] = requestsWithYourVote.map(r => r.request_id);
    const requestHasYourVote: boolean[] = songRequests.map(r => requestsWithYourVoteArray.includes(r.request_id));

    /*
select sr.request_id
from song_requests sr
         left join request_votes v on v.request_id = sr.request_id
where sr.playlist_id = 'playlist1'
  and v.user_id = 'aaron' and sr.request_status = 'pending';
     */
    /*
SELECT r.request_id, r.request_type, r.song_id, r.created_at, COUNT(v.request_id) AS num_votes
FROM song_requests AS r LEFT JOIN request_votes AS v
                                  ON r.request_id = v.request_id
WHERE r.playlist_id = 'playlist1' AND r.request_status = 'pending'
GROUP BY r.request_id;
     */

    const tracks = await getTracks(authHeader, songRequests.map(request => request.song_id));
    // todo: handle error
    // todo: add Spotify types?

    assert(songRequests.length === tracks.length);

    const addRequests = [];
    const removeRequests = [];

    for (let i = 0; i < songRequests.length; i++) {
        const songRequest = songRequests[i];
        const track = tracks[i];
        const hasYourVote = requestHasYourVote[i];
        const apiSongRequest = {
            requestId: songRequest.request_id,
            requestType: songRequest.request_type,
            title: track.name,
            artist: track.artists.map((artist: any) => artist.name).join(", "),
            album: track.album.name,
            dateAdded: songRequest.created_at.toISOString(),
            duration: track.duration_ms,
            numVotes: songRequest.num_votes,
            hasYourVote: hasYourVote
        };
        if (songRequest.request_type === dbTypes.RequestType.Add) {
            addRequests.push(apiSongRequest);
        } else {
            removeRequests.push(apiSongRequest);
        }
    }

    const songRequestList: apiTypes.SongRequestList = {
        areYouAdmin: isAdmin,
        addRequests: addRequests,
        removeRequests: removeRequests
    };

    // console.log(JSON.stringify(tracksResponse.body));
    return res.status(OK).json(songRequestList);
}

async function getTracks(authHeader: string | undefined, songIds: string[]): Promise<any[]> {
    const tracksResponse: GotResponse<any> = await got("https://api.spotify.com/v1/tracks", {
        headers: {
            Authorization: authHeader
        },
        searchParams: {
            ids: songIds.join(","),
            market: "from_token"
        },
        responseType: "json"
    });
    return tracksResponse.body.tracks;
}

export async function requestSongs(req: Request, res: Response) {
    const authHeader = req.header("Authorization");
    const userId = await getUserId(authHeader);

    const body: apiTypes.SongUpdateList = req.body;
    // todo: is this "if" needed?
    if (body.songsToAdd.length === 0 && body.songsToRemove.length === 0) {
        return res.status(OK).json({songsAlreadyInPlaylist: [], songsNotInPlaylist: []});
    }

    // enforce that all songs are valid
    const allIds = body.songsToAdd.concat(body.songsToRemove);
    const allTracks = await getTracks(authHeader, allIds);
    const nullTracks = Array.from(allTracks.entries()).filter(([, track]) => track === null);
    if (nullTracks.length > 0) {
        return res.status(UNPROCESSABLE_ENTITY).json({
            invalidSongIds: nullTracks.map(([i, ]) => allIds[i])
        });
    }

    // get the songs in the playlist
    const playlistSongIds: string[] = await getSongsInPlaylist(req.params.playlistId, authHeader);

    // compare requested songs to those in playlist
    console.log(`request body: ${JSON.stringify(body)}`);
    const songsToAdd = _.uniq(body.songsToAdd);
    const songsToRemove = _.uniq(body.songsToRemove);
    const [songsAlreadyInPlaylist, filteredSongsToAdd] = _.partition(songsToAdd, songId => playlistSongIds.includes(songId));
    const [filteredSongsToRemove, songsNotInPlaylist] = _.partition(songsToRemove, songId => playlistSongIds.includes(songId));

    const songIdToRequest = (requestType: dbTypes.RequestType) => (songId: string) => ([
        songId,
        requestType
    ]);
    const allRequests = filteredSongsToAdd.map(songIdToRequest(dbTypes.RequestType.Add))
        .concat(filteredSongsToRemove.map(songIdToRequest(dbTypes.RequestType.Remove)));

    console.log("now i'm here");
    const existingRequests = await db.select(["request_id", "song_id", "request_type"]).from("song_requests")
        .whereIn(["song_id", "request_type"], allRequests);
    console.log("now I'm there");

    const newRequests = allRequests.filter(request => !existingRequests.some(existingRequest => existingRequest.song_id === request[0] && existingRequest.request_type === request[1]));
    // todo: enforce that song IDs are valid Spotify tracks
    const existingRequestsVotedFor = await db.select(["request_id"]).from("request_votes")
        .whereIn("request_id", existingRequests.map(request => request.request_id))
        .andWhere("user_id", userId);
    console.log("now I'm there2");
    const existingRequestsNotVotedFor = existingRequests.filter(request => !existingRequestsVotedFor.some(requestVotedFor => requestVotedFor.request_id === request.request_id));
    // todo: unit test

    if (existingRequestsNotVotedFor.length > 0) {
        await db("request_votes").insert(existingRequestsNotVotedFor.map(request => ({request_id: request.request_id, user_id: userId})));
    }
    console.log("now I'm there3");
    if (newRequests.length > 0) {
        const requestIdList = await db("song_requests").insert(newRequests.map(request => ({
            playlist_id: req.params.playlistId,
            request_type: request[1],
            song_id: request[0],
            request_status: commonTypes.RequestStatus.Pending,
        })));
        const firstRequestId = requestIdList[0];
        await db("request_votes").insert(_.range(firstRequestId, firstRequestId + newRequests.length).map(requestId => ({
            request_id: requestId,
            user_id: userId
        })));
    }
    console.log("now I'm there4");

    // of the songsToAdd, check which ones are in the playlist already
    // of the songsToRemove, check which ones are not in the playlist
    return res.status(OK).json({
        songsAlreadyInPlaylist: songsAlreadyInPlaylist,
        songsNotInPlaylist: songsNotInPlaylist
    });
}

async function getSongsInPlaylist(playlistId: string, authHeader: string | undefined): Promise<string[]> {
    const playlistTracksResponse: GotResponse<any> = await got(`https://api.spotify.com/v1/playlists/${playlistId}`, {
        headers: {
            Authorization: authHeader
        },
        searchParams: {
            fields: "tracks.items(track(id))",
            market: "from_token"
        },
        responseType: "json"
    });
    return playlistTracksResponse.body.tracks.items.map((item: any) => item.track.id);
}

export async function updateRequestStatus(req: Request, res: Response) {
    return res.status(OK).json({});
}

export async function voteForRequest(req: Request, res: Response) {

}

export async function removeVoteForRequest(req: Request, res: Response) {

}
