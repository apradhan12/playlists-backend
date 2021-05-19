import {Request, Response} from 'express';
import StatusCodes from "http-status-codes";
import {db} from "../common/database.js";
import * as apiTypes from "../common/apiTypes.js";
import * as commonTypes from "../common/commonTypes.js";
import assert from "assert";
import * as dbTypes from "../common/dbTypes.js";
import got, {Response as GotResponse} from "got";
import {RequestStatus} from "../common/commonTypes.js";
import {Conflict, InternalServerError, NotFound, Unauthorized} from "../common/errors.js";
import _ from "lodash";
import {getPlaylistAdministrators} from "../common/dbCalls.js";
import {getPlaylist, getUserId} from "../common/apiCalls.js";

const { OK, UNPROCESSABLE_ENTITY, FORBIDDEN, BAD_REQUEST, UNAUTHORIZED } = StatusCodes;

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

export async function getSongRequests(req: Request, res: Response) {
    console.log("getting song requests");
    const [authHeader, userId] = await getUserId(req);

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
    let tracks = [];
    if (songRequests.length > 0) {
        tracks = await getTracks(authHeader, songRequests.map(request => request.song_id));
    }
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
    try {
        const tracksResponse: GotResponse<any> = await got("https://api.spotify.com/v1/tracks", {
            headers: {
                Authorization: authHeader
            },
            searchParams: {
                ids: songIds.join(",")
            },
            responseType: "json"
        });
        return tracksResponse.body.tracks;
    } catch (error) {
        if (error.response.statusCode === UNAUTHORIZED) {
            throw new Unauthorized("Access token is unauthorized");
            // todo: request new access token from Spotify, then let the client know by sending it in the response
        }
        throw new InternalServerError(error.response.body);
    }
}

export async function requestSongs(req: Request, res: Response) {
    const [authHeader, userId] = await getUserId(req);

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
    console.log(`Here are the songs in the playlist: ${playlistSongIds.slice(0, 10)}, ${songsToRemove}`);

    const songIdToRequest = (requestType: dbTypes.RequestType) => (songId: string) => ([
        songId,
        requestType
    ]);
    const allRequests = filteredSongsToAdd.map(songIdToRequest(dbTypes.RequestType.Add))
        .concat(filteredSongsToRemove.map(songIdToRequest(dbTypes.RequestType.Remove)));

    console.log("now i'm here");
    const existingRequests = await db.select(["request_id", "song_id", "request_type"]).from("song_requests")
        .whereIn(["song_id", "request_type"], allRequests).andWhere({playlist_id: req.params.playlistId});
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
    console.log(`new requests: ${JSON.stringify(newRequests)}`);
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

async function getSongsInPlaylist(playlistId: string, authHeader: string): Promise<string[]> {
    const playlist = await getPlaylist(playlistId, authHeader);
    return getTrackIdsFromPlaylist(playlist);
}

function getTrackIdsFromPlaylist(playlist: any): string[] {
    return playlist.tracks.items.map((item: any) => item.track.id);
}

export async function updateRequestStatus(req: Request, res: Response) {
    const [authHeader, userId] = await getUserId(req);
    const playlistId = req.params.playlistId;
    const playlist = await getPlaylist(playlistId, authHeader);
    const request = await checkPendingRequest(req.params.requestId);
    if(!await checkIsManager(userId, playlistId, playlist)) {
        return res.status(FORBIDDEN).json({
            message: "You are not an administrator of this playlist"
        });
    }

    const body: apiTypes.SongRequestStatusUpdate = req.body;
    if (body.status === commonTypes.RequestStatus.Approved) {
        const success = await applyRequestToPlaylist(request, playlist, authHeader);
        console.log("applied to playlist");
        await finishRequestRecord(req.params.requestId, body.status);
        console.log("finished request record");
        if (!success) {
            return res.status(OK).json({
                message: "The request was finished but not applied because the playlist state is already in accord with the request"
            });
        }
    } else if (body.status === commonTypes.RequestStatus.Rejected) {
        await finishRequestRecord(req.params.requestId, body.status);
    } else {
        return res.status(UNPROCESSABLE_ENTITY).json({
            message: "Cannot set a request to pending"
        });
    }

    // make sure the user is the owner or an admin of the playlist
    // make sure the request ID exists, and for now make sure the status is pending - just fetch the whole request
    // update the request status
    // if going from pending to rejected/approved:
    // - change request_status field in DB
    // - add delete_at timestamp five minutes in the future
    // - if approve, add/remove song to/from playlist (only add if not in playlist already)
    // - if reject, do nothing

    // if going from approved to pending:
    // - if the request was a remove request, add the song to the end of the playlist
    // - if the request was an add request, remove all instances of the song from the playlist
    // - change the status to Pending, and set delete_at to null

    // if going from rejected to pending:
    // - change the status to Pending, and set delete_at to null
    console.log("returning");
    return res.status(OK).json({});
}

async function checkPendingRequest(requestId: string): Promise<any> {
    const rows = await db.select(["request_type", "song_id", "request_status"]).from("song_requests").where({
        request_id: requestId
    });
    const request = rows[0];
    if (request.request_status !== commonTypes.RequestStatus.Pending) {
        throw new Conflict(`Request status is ${request.request_status}, expected pending`);
    }
    return request;
}

async function checkIsManager(userId: string, playlistId: string, playlist: any): Promise<boolean> {
    if (playlist.owner.id === userId) {
        return true;
    }
    const admins = await getPlaylistAdministrators(playlistId);
    return admins.includes(userId);
}

async function finishRequestRecord(requestId: string, status: commonTypes.RequestStatus) {
    // YYYY-MM-DD HH:MI:SS
    await db("song_requests")
        .where({request_id: requestId})
        .update({
            request_status: status,
            delete_at: formatDateForSQL(addMinutesToDate(new Date(), 5))
        });
}

/**
 * Returns true if the request was applied to the playlist, false otherwise (e.g. if the playlist already had the song).
 */
async function applyRequestToPlaylist(request: any, playlist: any, authHeader: string): Promise<boolean> {
    // todo: for now we assume the user is the owner, but later use access tokens from DB to let other admins approve

    const trackIds = getTrackIdsFromPlaylist(playlist);
    if (request.request_type === dbTypes.RequestType.Add) {
        if (trackIds.includes(request.song_id)) {
            return false;
        }
        console.log("here we go");
        const response = await got(`https://api.spotify.com/v1/playlists/${playlist.id}/tracks`, {
            headers: {
                Authorization: authHeader
            },
            searchParams: {
                uris: `spotify:track:${request.song_id}`
            },
            method: "POST",
            responseType: "json"
        });
        console.log("done");
        if (response.statusCode >= 200 && response.statusCode < 300) {
            return true;
        }
    } else if (request.request_type === dbTypes.RequestType.Remove) {
        if (!trackIds.includes(request.song_id)) {
            return false;
        }
        const response = await got(`https://api.spotify.com/v1/playlists/${playlist.id}/tracks`, {
            headers: {
                Authorization: authHeader,
                "Content-Type": "application/json",
            },
            json: {
                tracks: [{uri: `spotify:track:${request.song_id}`}]
            },
            method: "DELETE",
            responseType: "json"
        });
        if (response.statusCode >= 200 && response.statusCode < 300) {
            return true;
        }
    }
    return false;
}

function addMinutesToDate(date: Date, minutes: number) {
    return new Date(date.getTime() + minutes * 60000);
}

function formatDateForSQL(date: Date) {
    return date.toISOString().slice(0, 19).replace('T', ' ');
}

async function getRequest(requestId: number): Promise<dbTypes.SongRequest> {
    const requests = await db.select("*").from("song_requests")
        .where({
            request_id: requestId
        });
    if (requests.length === 0) {
        throw new NotFound(`No request could be found with ID ${requestId}`);
    }
    return requests[0];
}

async function handleVotes(req: Request, res: Response, countCondition: (voteCount: number) => boolean, dbAction: (requestId: number, userId: string) => Promise<void>) {
    const [, userId] = await getUserId(req); // validate user
    const requestId = parseInt(req.params.requestId);
    if (isNaN(requestId)) {
        return res.status(BAD_REQUEST).json({
            message: `${req.params.requestId} is not a number`
        });
    }
    await getRequest(requestId); // validate request
    const votes = await db("request_votes").count<Record<string, number>[]>("vote_id as count").where({
        request_id: requestId,
        user_id: userId
    });
    if (countCondition(votes[0].count)) {
        await dbAction(requestId, userId);
    }
    return res.status(OK).json({});
}

export async function voteForRequest(req: Request, res: Response) {
    // todo: prevent voting on requests scheduled for deletion
    return await handleVotes(req, res, count => count === 0,
        async (requestId: number, userId: string) => await db("request_votes").insert({
            request_id: requestId,
            user_id: userId
        }));
}

export async function removeVoteForRequest(req: Request, res: Response) {
    return await handleVotes(req, res, count => count === 1,
        async (requestId: number, userId: string) => await db("request_votes").where({
            request_id: requestId,
            user_id: userId
        }).del());
}
