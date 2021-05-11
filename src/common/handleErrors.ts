import { GeneralError } from "./errors.js";
import {Request, Response} from "express";

export const handleErrors = (err: any, req: Request, res: Response) => {
    console.error(err);
    if (err instanceof GeneralError) {
        return res.status(err.getCode()).json({
            status: 'error',
            message: err.message
        });
    }
    return res.status(500).json({
        status: 'error',
        message: err.message
    });
};
