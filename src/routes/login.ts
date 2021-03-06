import { Request, Response } from 'express';
import got, { Response as GotResponse } from 'got';
import querystring from "querystring";
import {db} from "../common/database.js";
import {User} from "../common/dbTypes.js";
import {StatusCodes} from "http-status-codes";

const STATE_KEY = 'spotify_auth_state';
const CLIENT_ID = process.env.CLIENT_ID; // Your client id
const CLIENT_SECRET = process.env.CLIENT_SECRET; // Your secret
const REDIRECT_URL = 'http://localhost:8888/callback'; // Your redirect uri

const { OK } = StatusCodes;

/**
 * Generates a random string containing numbers and letters
 * @param  {number} length The length of the string
 * @return {string} The generated string
 */
const generateRandomString = function (length: number) {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
};

export async function login(req: Request, res: Response) {
    const state = generateRandomString(16);
    res.cookie(STATE_KEY, state);

    // your application requests authorization
    const scope = 'user-read-private user-read-email playlist-modify-public playlist-read-private';
    res.redirect('https://accounts.spotify.com/authorize?' +
        querystring.stringify({
            response_type: 'code',
            client_id: CLIENT_ID,
            scope: scope,
            redirect_uri: REDIRECT_URL,
            state: state
        }));
}

function getAuthorizationHeaders(): any {
    return {
        'Authorization': 'Basic ' + (Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64')),
        "Content-Type": "application/x-www-form-urlencoded"
    };
}

interface ClientCredentialsResponse {
    access_token: string;
    token_type: string;
    expires_in: number;
}

interface AuthorizationCodeFlowResponse {
    access_token: string;
    token_type: string;
    expires_in: number;
    scope: string;
    refresh_token: string;
}

export async function getClientCredentials(req: Request, res: Response) {
    const response: GotResponse<ClientCredentialsResponse> = await got('https://accounts.spotify.com/api/token', {
        method: "post",
        form: {
            grant_type: 'client_credentials'
        },
        headers: getAuthorizationHeaders(),
        responseType: "json"
    });
    const body = response.body;
    const access_token = body.access_token;
    return res.status(OK).json({
        access_token: access_token
    });
}

export async function callback(req: Request, res: Response) {
    // your application requests refresh and access tokens
    // after checking the state parameter

    const code = req.query.code || null;
    const state = req.query.state || null;
    const storedState = req.cookies ? req.cookies[STATE_KEY] : null;

    if (state === null || state !== storedState) {
        res.redirect('/#' +
            querystring.stringify({
                error: 'state_mismatch'
            }));
    } else {
        res.clearCookie(STATE_KEY);
        const response: GotResponse<AuthorizationCodeFlowResponse> = await got('https://accounts.spotify.com/api/token', {
            method: "post",
            form: {
                code: code,
                redirect_uri: REDIRECT_URL,
                grant_type: 'authorization_code'
            },
            headers: getAuthorizationHeaders(),
            responseType: "json"
        })
        const body = response.body;
        const access_token = body.access_token;
        const refresh_token = body.refresh_token;

        // use the access token to access the Spotify Web API
        got('https://api.spotify.com/v1/me', {
            method: "get",
            headers: {'Authorization': 'Bearer ' + access_token},
            responseType: "json"
        }).then(async (response: GotResponse<any>) => {
            const userId = response.body.id;
            const user: User = {
                user_id: userId,
                access_token: access_token,
                refresh_token: refresh_token
            }
            // TODO: make this a transaction?
            await db("users")
                .where("user_id", userId)
                .del();
            await db("users").insert(user);
            console.log(`Inserted ${JSON.stringify(user)}`);

            // we can also pass the token to the browser to make requests from there
            res.redirect('http://localhost:3000/callback?' +
                querystring.stringify({
                    user_id: userId,
                    display_name: response.body.display_name,
                    profile_picture_url: response.body.images[0].url,
                    access_token: access_token,
                    refresh_token: refresh_token
                }));
        });
        // console.log(`ERROR: ${error}`);
        // res.redirect('/#' +
        //     querystring.stringify({
        //         error: 'invalid_token'
        //     }));
    }
}

// todo: update users database in this function?
export async function refreshToken(req: Request, res: Response) {
    // requesting access token from refresh token
    const refresh_token = req.query.refresh_token;

    got('https://accounts.spotify.com/api/token', {
        method: "post",
        responseType: "json",
        form: {
            "grant_type": "refresh_token",
            "refresh_token": refresh_token
        },
        headers: {
            'Authorization': 'Basic ' + (Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64')),
            "Content-Type": "application/x-www-form-urlencoded"
        }
    }).then((response: any) => {
        const access_token = response.body.access_token;
        res.send({
            'access_token': access_token
        });
    });
}
