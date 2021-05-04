import { Request, Response } from 'express';
import StatusCodes from "http-status-codes";

const { OK } = StatusCodes;

export async function updateSongs(req: Request, res: Response) {
    return res.status(OK).json({});
}
