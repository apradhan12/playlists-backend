import { Request, Response } from 'express';
import StatusCodes from "http-status-codes";
import {db} from "../common/database.js";

const { OK } = StatusCodes;

export async function getSongRequests(req: Request, res: Response) {
    const rows = await db.select().from("song_requests")
        .where({
            playlist_id: req.params.playlistId
        });
    return res.status(OK).json(rows);
}

export async function requestSongs(req: Request, res: Response) {
    return res.status(OK).json({});
}

export async function updateRequestStatus(req: Request, res: Response) {
    return res.status(OK).json({});
}
