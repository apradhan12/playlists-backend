import {Router} from 'express';
import {updateSongs} from "./songs.js";
import {getSongRequests, requestSongs, updateRequestStatus} from "./requests.js";
import {getAdministrators, updateAdministrators} from "./administrators.js";
import {callback, login, refreshToken} from "./login.js";
import cors from "cors";
import cookieParser from "cookie-parser";

const songRouter = Router();
songRouter.put('/', updateSongs);

const requestRouter = Router();
requestRouter.get('/', getSongRequests);
requestRouter.post('/', requestSongs);
requestRouter.put('/:requestId', updateRequestStatus);

const adminRouter = Router();
adminRouter.get('/', getAdministrators);
adminRouter.put('/', updateAdministrators);

const playlistRouter = Router();
playlistRouter.use('/songs', songRouter);
playlistRouter.use('/requests', requestRouter);
playlistRouter.use('/administrators', adminRouter);

const baseRouter = Router();
baseRouter.use(cors())
    .use(cookieParser());
baseRouter.use('/playlists/:playlistId', playlistRouter);
baseRouter.get('/login', login);
baseRouter.get('/callback', callback);
baseRouter.get('/refresh_token', refreshToken);

export default baseRouter;
