import {NextFunction, Request, Response} from "express";

export const handleErrors = (err: any, req: Request, res: Response, _: NextFunction) => {
    // console.log(JSON.stringify(err));
    if (err.hasOwnProperty("code")) {
        return res.status(err.code).json({
            status: 'error',
            message: err.message
        });
    }
    console.error(err);
    return res.status(500).json({
        status: 'error',
        message: err.message
    });
};
