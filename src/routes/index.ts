import {Router} from 'express';
import {updateSongs} from "./songs.js";
import {getSongRequests, removeVoteForRequest, requestSongs, updateRequestStatus, voteForRequest} from "./requests.js";
import {getAdministrators, updateAdministrators} from "./administrators.js";
import {callback, getClientCredentials, login, refreshToken} from "./login.js";
import cors from "cors";
import cookieParser from "cookie-parser";
import expressAsyncHandler from "express-async-handler";

const songRouter = Router({mergeParams: true});
songRouter.put('/', expressAsyncHandler(updateSongs));

const requestRouter = Router({mergeParams: true});
requestRouter.get('/', expressAsyncHandler(getSongRequests));
requestRouter.post('/', expressAsyncHandler(requestSongs));
requestRouter.put('/:requestId', expressAsyncHandler(updateRequestStatus));
requestRouter.post('/:requestId/vote', expressAsyncHandler(voteForRequest));
requestRouter.delete('/:requestId/vote', expressAsyncHandler(removeVoteForRequest));

const adminRouter = Router({mergeParams: true});
adminRouter.get('/', expressAsyncHandler(getAdministrators));
adminRouter.put('/', expressAsyncHandler(updateAdministrators));

const playlistRouter = Router({mergeParams: true});
playlistRouter.use('/songs', expressAsyncHandler(songRouter));
playlistRouter.use('/requests', expressAsyncHandler(requestRouter));
playlistRouter.use('/administrators', expressAsyncHandler(adminRouter));

const baseRouter = Router();
baseRouter.use(cors())
    .use(cookieParser());
baseRouter.use('/playlists/:playlistId', expressAsyncHandler(playlistRouter));
baseRouter.get('/login', expressAsyncHandler(login));
baseRouter.get('/callback', expressAsyncHandler(callback));
baseRouter.get('/refresh_token', expressAsyncHandler(refreshToken));
baseRouter.get('/client_credentials', expressAsyncHandler(getClientCredentials));

export default baseRouter;
