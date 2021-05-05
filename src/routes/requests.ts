import { Request, Response } from 'express';
import StatusCodes from "http-status-codes";
import {db} from "../common/database.js";
import {SongRequestList} from "../common/apiTypes.js";
import assert from "assert";
import * as dbTypes from "../common/dbTypes.js";
import * as apiTypes from "../common/apiTypes.js";
import got, { Response as GotResponse } from "got";
import _ from "lodash";
import {RequestStatus} from "../common/commonTypes.js";

const { OK, BAD_REQUEST } = StatusCodes;

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
    // validate Authorization header
    const authHeader = req.header("Authorization");
    if (authHeader === undefined) {
        return res.status(BAD_REQUEST).json({}); // todo
    }
    const regexMatch = authHeader.match(/^Bearer (.*)$/);
    if (regexMatch === null) {
        return res.status(BAD_REQUEST).json({}); // todo
    }
    const accessToken = regexMatch[1];

    // get user from access token
    const userIds = await db.select("user_id").from("users")
        .where({
            access_token: accessToken
        });
    assert(userIds.length === 1);
    const userId = userIds[0].user_id;
    // todo: error handle if more than one user ID

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
            "r.status": RequestStatus.Pending
        })
        .groupBy("r.request_id");

    const requestsWithYourVote: RequestId[] = await db.select(["r.request_id"])
        .from({r: "song_requests"}).leftJoin({v: "request_votes"}, "r.request_id", "=", "v.request_id")
        .where({
            "r.playlist_id": req.params.playlistId,
            "r.status": RequestStatus.Pending,
            "v.user_id": userId
        });
    const requestsWithYourVoteArray: number[] = requestsWithYourVote.map(r => r.request_id);
    const requestHasYourVote: boolean[] = songRequests.map(r => requestsWithYourVoteArray.includes(r.request_id));

    /*
select sr.request_id
from song_requests sr
         left join request_votes v on v.request_id = sr.request_id
where sr.playlist_id = 'playlist1'
  and v.user_id = 'aaron' and sr.status = 'pending';
     */
    /*
SELECT r.request_id, r.request_type, r.song_id, r.created_at, COUNT(v.request_id) AS num_votes
FROM song_requests AS r LEFT JOIN request_votes AS v
                                  ON r.request_id = v.request_id
WHERE r.playlist_id = 'playlist1' AND r.status = 'pending'
GROUP BY r.request_id;
     */

    const tracksResponse: GotResponse<any> = await got("https://api.spotify.com/v1/tracks", {
        headers: {
            Authorization: authHeader
        },
        searchParams: {
            ids: songRequests.map(request => request.song_id).join(","),
            market: "from_token"
        },
        responseType: "json"
    });
    // todo: handle error
    // todo: add Spotify types?

    assert(songRequests.length === tracksResponse.body.tracks.length);

    const addRequests = [];
    const removeRequests = [];

    for (let i = 0; i < songRequests.length; i++) {
        const songRequest = songRequests[i];
        const track = tracksResponse.body.tracks[i];
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

export async function requestSongs(req: Request, res: Response) {
    return res.status(OK).json({});
}

export async function updateRequestStatus(req: Request, res: Response) {
    return res.status(OK).json({});
}

export async function voteForRequest(req: Request, res: Response) {

}

export async function removeVoteForRequest(req: Request, res: Response) {

}
