import {Request} from "express";
import {NotFound, Unauthorized} from "./errors.js";
import {db} from "./database.js";
import assert from "assert";
import {Response as GotResponse} from "got/dist/source/core";
import got from "got";
import {StatusCodes} from "http-status-codes";

const { NOT_FOUND } = StatusCodes;

export async function getUserId(req: Request): Promise<[authHeader: string, userId: string]> {
    // validate Authorization header
    const authHeader = req.header("Authorization");
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
    return [authHeader, userIds[0].user_id];
}

export async function getPlaylist(playlistId: string, authHeader: string): Promise<any> {
    const playlistResponse: GotResponse<any> = await got(`https://api.spotify.com/v1/playlists/${playlistId}`, {
        headers: {
            Authorization: authHeader
        },
        searchParams: {
            fields: "id,owner.id,owner.display_name,tracks.items(track(id))",
            market: "from_token"
        },
        responseType: "json"
    });
    if (playlistResponse.statusCode == NOT_FOUND) {
        throw new NotFound(`Playlist ${playlistId} does not exist`);
    }
    return playlistResponse.body;
}
