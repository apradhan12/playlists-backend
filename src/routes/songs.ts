import { Request, Response } from 'express';
import StatusCodes from "http-status-codes";

const { OK } = StatusCodes;

export async function getSongs(req: Request, res: Response) {

}

export async function updateSongs(req: Request, res: Response) {
    return res.status(OK).json({});
}
