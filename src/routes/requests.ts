import { Request, Response } from 'express';
import StatusCodes from "http-status-codes";
import {db} from "../common/database.js";
import {SongRequestList} from "../common/apiTypes.js";
import assert from "assert";
import * as dbTypes from "../common/dbTypes.js";

const { OK, BAD_REQUEST } = StatusCodes;

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
    const userId = userIds[0];
    // todo: error handle if more than one user ID

    const adminRows = await db.select().from("administrators")
        .where({
            playlist_id: req.params.playlistId,
            user_id: userId
        });
    assert(adminRows.length <= 1);

    const isAdmin = adminRows.length === 1;

    // todo: request these concurrently
    const addRequests: dbTypes.SongRequest[] = await db.select().from("song_requests")
        .where({
            playlist_id: req.params.playlistId,
            request_type: dbTypes.RequestType.Add
        });

    const removeRequests: dbTypes.SongRequest[] = await db.select().from("song_requests")
        .where({
            playlist_id: req.params.playlistId,
            request_type: dbTypes.RequestType.Remove
        });

    // TODO: look at https://api.spotify.com/v1/tracks

    return res.status(OK).json(addRequests);
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
