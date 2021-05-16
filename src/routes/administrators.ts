import { Request, Response } from 'express';
import StatusCodes from "http-status-codes";
import {getPlaylist, getUserId} from "../common/apiCalls.js";
import {getPlaylistAdministrators} from "../common/dbCalls.js";
import got, { Response as GotResponse } from "got";
import {Forbidden, UnprocessableEntity} from "../common/errors.js";
import {UserUpdateList} from "../common/apiTypes.js";
import _ from "lodash";
import {db} from "../common/database.js";

const { OK } = StatusCodes;

const MAX_NUMBER_OF_ADMINISTRATORS = 10;

export async function getAdministrators(req: Request, res: Response) {
    const [authHeader,] = await getUserId(req);
    const playlistId = req.params.playlistId;
    const playlist = await getPlaylist(playlistId, authHeader);
    const ownerId = playlist.owner.id;
    const ownerDisplayName = playlist.owner.display_name; // todo: what if no display name? is this possible?
    const adminIds = await getPlaylistAdministrators(playlistId);

    const adminResponseBodies = await getUsers(authHeader, adminIds);
    const displayNames: string[] = adminResponseBodies.map((body: any) => body.display_name);

    const administrators = [];
    for (let i = 0; i < adminIds.length; i++) {
        administrators.push({
            displayName: displayNames[i],
            userId: adminIds[i]
        });
    }

    return res.status(OK).json({
        owner: {
            displayName: ownerDisplayName,
            userId: ownerId
        },
        administrators: administrators
    });
}

async function getUsers(authHeader: string, userIds: string[]): Promise<any> {
    const responses = await Promise.all(userIds.map(async (adminId: string): Promise<GotResponse<any>> =>
        got(`https://api.spotify.com/v1/users/${adminId}`, {
            headers: {
                Authorization: authHeader
            },
            responseType: "json"
        })));
    // todo: add catch block for promise; retry if rate limited
    // todo: throw error if we ever get a 404
    return responses.map(response => response.body);
}

export async function updateAdministrators(req: Request, res: Response) {
    /*
    Make sure the playlist exists (get the playlist)
    Make sure the user is the owner (only owner can update admins)
    Get current administrators from DB
    Determine which ones actually need to be added and removed
    Calculate the new number of admins, check that it is less than or equal to the max
    Check that all the users are valid
    Run the DB calls
     */
    const [authHeader, userId] = await getUserId(req);
    const playlistId = req.params.playlistId;
    const playlist = await getPlaylist(playlistId, authHeader);
    if (userId !== playlist.owner.id) {
        throw new Forbidden("You are not the owner of this playlist");
    }
    const administrators = await getPlaylistAdministrators(playlistId);
    const body: UserUpdateList = req.body;

    // todo: abstract out the logic from here and requestSongs route
    const adminsToAdd = _.uniq(body.usersToAdd);
    const adminsToRemove = _.uniq(body.usersToRemove);

    const [adminsAlreadyInList, filteredAdminsToAdd] = _.partition(adminsToAdd, userId => administrators.includes(userId));
    const [filteredAdminsToRemove, adminsNotInList] = _.partition(adminsToRemove, userId => administrators.includes(userId));

    const newLength = administrators.length + filteredAdminsToAdd.length - filteredAdminsToRemove.length;
    if (newLength > MAX_NUMBER_OF_ADMINISTRATORS) {
        throw new UnprocessableEntity(`A maximum of ${MAX_NUMBER_OF_ADMINISTRATORS} is allowed per playlist`);
    }
    await getUsers(authHeader, filteredAdminsToAdd.concat(filteredAdminsToRemove)); // validate users

    // todo: run concurrently
    if (filteredAdminsToAdd.length > 0) {
        await db("administrators").insert(filteredAdminsToAdd.map(adminId => ({
            playlist_id: playlistId,
            user_id: adminId
        })));
    }
    if (filteredAdminsToRemove.length > 0) {
        await db("administrators").whereIn("user_id", filteredAdminsToRemove).andWhere({playlist_id: playlistId}).del();
    }
    return res.status(OK).json({});
}
