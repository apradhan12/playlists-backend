/**
 * This is an example of a basic node.js script that performs
 * the Authorization Code oAuth2 flow to authenticate against
 * the Spotify Accounts.
 *
 * For more information, read
 * https://developer.spotify.com/web-api/authorization-guide/#authorization_code_flow
 */
const express = require('express'); // Express web server framework

const got = require('got');

const cors = require('cors');
const querystring = require('querystring');
const cookieParser = require('cookie-parser');

const client_id = process.env.CLIENT_ID; // Your client id
const client_secret = process.env.CLIENT_SECRET; // Your secret
const redirect_uri = 'http://localhost:8888/callback'; // Your redirect uri

/**
 * Generates a random string containing numbers and letters
 * @param  {number} length The length of the string
 * @return {string} The generated string
 */
const generateRandomString = function (length) {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

const stateKey = 'spotify_auth_state';

const app = express();

app.use(express.static(__dirname + '/../public'))
   .use(cors())
   .use(cookieParser());

app.get('/login', function(req, res) {

  const state = generateRandomString(16);
  res.cookie(stateKey, state);

  // your application requests authorization
  const scope = 'user-read-private user-read-email';
  res.redirect('https://accounts.spotify.com/authorize?' +
    querystring.stringify({
      response_type: 'code',
      client_id: client_id,
      scope: scope,
      redirect_uri: redirect_uri,
      state: state
    }));
});

app.get('/callback', function(req, res) {

  // your application requests refresh and access tokens
  // after checking the state parameter

  const code = req.query.code || null;
  const state = req.query.state || null;
  const storedState = req.cookies ? req.cookies[stateKey] : null;

  if (state === null || state !== storedState) {
    res.redirect('/#' +
      querystring.stringify({
        error: 'state_mismatch'
      }));
  } else {
    res.clearCookie(stateKey);
    got('https://accounts.spotify.com/api/token', {
      method: "post",
      form: {
        code: code,
        redirect_uri: redirect_uri,
        grant_type: 'authorization_code'
      },
      headers: {
        'Authorization': 'Basic ' + (Buffer.from(client_id + ':' + client_secret).toString('base64')),
        "Content-Type": "application/x-www-form-urlencoded"
      },
      responseType: "json"
    }).then(response => {
      const body = response.body;
      const access_token = body.access_token;
      const refresh_token = body.refresh_token;

      // use the access token to access the Spotify Web API
      got('https://api.spotify.com/v1/me', {
        method: "get",
        headers: {'Authorization': 'Bearer ' + access_token},
        responseType: "json"
      }).then(response => {
        console.log(JSON.stringify(response.body));
      });

      // we can also pass the token to the browser to make requests from there
      res.redirect('http://localhost:3000/?' +
          querystring.stringify({
            access_token: access_token,
            refresh_token: refresh_token
          }));
    }).catch(error => {
      console.log(`ERROR: ${error}`);
      res.redirect('/#' +
          querystring.stringify({
            error: 'invalid_token'
          }));
    });
  }
});

app.get('/refresh_token', function(req, res) {

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
      'Authorization': 'Basic ' + (Buffer.from(client_id + ':' + client_secret).toString('base64')),
      "Content-Type": "application/x-www-form-urlencoded"
    }
  }).then(response => {
    const access_token = response.body.access_token;
    res.send({
      'access_token': access_token
    });
  });
});

console.log('Listening on 8888');
app.listen(8888);
