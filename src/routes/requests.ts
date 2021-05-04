import { Request, Response } from 'express';
import knex from "knex";
import StatusCodes from "http-status-codes";

const { OK } = StatusCodes;

const db = knex({
    client: "mysql2",
    connection: {
        host: "localhost",
        port: 3306,
        user: "root",
        password: process.env.DATABASE_PASSWORD,
        database: 'playlists_app'
    }
});

export async function getSongRequests(req: Request, res: Response) {
    const rows = await db.select().from("song_requests")
        .where({
            playlist_id: req.params.playlistId
        })
        .then((rows: any) => {
            res.send(rows);
        });
    return res.status(OK).json(rows);
    // const users = await userDao.getAll();
    // return res.status(OK).json({users});
}

export async function requestSongs(req: Request, res: Response) {
    return res.status(OK).json({});
}

export async function updateRequestStatus(req: Request, res: Response) {
    return res.status(OK).json({});
}
