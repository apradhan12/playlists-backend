import { Request, Response } from 'express';
import StatusCodes from "http-status-codes";

const { OK } = StatusCodes;

export async function getAdministrators(req: Request, res: Response) {
    return res.status(OK).json({});
}

export async function updateAdministrators(req: Request, res: Response) {
    return res.status(OK).json({});
}
