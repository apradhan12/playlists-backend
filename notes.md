# Questions
- what happens to users' votes on a playlist when they become admins?
  - keep vote, but don't provide any indication
- Show playlists you manage somewhere (homepage)? we will need a route for this
- figure out what to do in case of API limits (rate limit, or max number of tracks to provide data about, etc.)
- How should we determine whether a user can manage a particular playlist?
  - when you log in, send a list of playlist IDs you administrate, and use that to show options
  - when you request a playlist page or a requests page, return isAdmin
  - what about if you stay logged in and refresh the page? Should we store the ids in local storage too?
  - What about when a user becomes an administrator of a playlist? We don't want to cache the wrong info for too long
  - **Best solution:** send the info whenever the user accesses a page that needs it, e.g. the homepage, a playlist page, or a requests page
- Problem: we don't know when the access token expires if we just keep it in the db.
  - add a pessimistic expiration date (i.e. earlier than actual) for the access token; force refresh a bit before it's required
  - allow access token whenever; refresh only when a call to the Spotify API is rejected
- How to know if a user is "actually" logged in?
  - their token in local storage could be fake
  - either:
    - you have to make a request to the server every time you access a page, OR
    - the display name is also stored locally and is only updated when the token is updated. This option would probably be okay because display name shouldn't be updated super often, but a user could log out and log back in.
- What happens when you log out?
  - You POST to the server, and it invalidates your token in the database
  - also, the local storage tokens are cleared
  - add this as a route
- What data should be maintained about your login?
  - refresh token (client- and server-side)
  - access token (client- and server-side)
  - display name (client-side)
  - user ID (client- and server-side)
- Should we do any kind of caching?
  - we'll do that later
- what if the playlist is manually changed (e.g. add song A) while there is a request to add song A?
  - don't delete the request, but if the request is approved, give an info message and don't apply the request
  - check it whenever someone votes on it, then delete it
  - check on it every N seconds in a background thread (probably too much load)
- decide whether to use market everywhere or nowhere
- when/how often to reload the playlists you administrate?
  - for now, whenever the page loads
- in what contexts should we separate owner vs. administrators?
  - probably all, since it maintains a single source of truth for each
- Should the GET administrators route combine the owner with the administrators, or should we have the frontend make the calls?
  - We already need to call the Spotify API on the backend to confirm the playlist's existence, so it would make sense to include
  - It should probably also send both user IDs and display names, since we may want to link to their profiles
- Should we prevent non-admins from seeing the admins list?
  - probably not necessary
- for updating admins, should we return admins who were already there or admins not in the list?
  - probably overkill, in fact same for requests - probably can get rid of that
- is it premature optimization to allow multiple admins to be added/removed at once?
  - not really, because that's just how the client flow works
  - we could have two separate routes for adding and for removing, but the logic isn't that complex and redundancy can be completely avoided by using "if length === 0" checks before API/DB calls
- Should the Spotify GET playlist API route be called from frontend, backend, or both?
  - no need to request the backend if the user isn't even authenticated - maybe slightly faster RTT
  - having the code on both frontend and backend leads to duplication - bad
  - it needs to be called on the backend for sure, since that determines how we make add/remove song requests
  - if we only do it on the backend, we can reuse the app API token (not sure if this is actually good)
  - we could move to a monorepo and share the code then, which could be helpful for other things (but also adds some annoyances)
    - OpenAPI schema could be shared, and possibly reused somehow
- When an add/remove song request has been made successfully, should the page re-request the backend, or just add it on the frontend manually?
  - For now, re-request the backend routes for the page
  - Easier to do this, and it will avoid duplicated logic (determining which song requests already exist, etc.)
- Should the burden be on the client to keep track of the app access token?
  - If the client provides no token at all, should the server *request* an access token on their behalf, use a *cached* access token, or *reject* the request?

# TODO
- undo approving a request/rejecting a request
- figure out timezone issues for delete_at
- add JSON Schema / OpenAPI validation for request bodies
- frontend: sort requests by votes
- handle rate limits
- use mutex or some kind of lock to prevent people from updating administrators while the server logic is being performed?
- use the client credentials flow in Spotify API requests where possible so that users don't need to be logged in unless they're on a page that needs authorization
- get beyond first 100 songs of a playlist where needed (e.g. in checking song requests)
- deal with lack of profile picture URL (and possibly display name) on both front- and back-end
- **think about types on the frontend**
- **think about code sharing on the frontend**
- find all locations where API/DB calls are made with potentially empty lists
- add a 404 page
- allow scrolling through search results with arrow keys
- make songsToAdd and songsToRemove optional in POST /requests route
- change axios.get calls to use the `axios()` format
- extend backend GET /requests route to allow unauthenticated users

- add a note for playlists owned by Spotify

 
# Bugs
- don't allow "Your request was made successfully" if you don't request to remove any songs
- hide the "Finish requesting song removals" button if there are no songs removed (change to "Cancel and close")

# Needed Spotify API routes
- log in
- get playlists recommended for you / playlists you follow/have saved (need seed_artists, seed_genres, or seed_tracks)
- get your profile picture, number of followers, playlists
- playlist icon, songs
- search songs/song details
- add/remove songs in your playlists
- create a new playlist
- list of PROFILES/user IDs you follow/who follow you (to recommend admins)
- follow a playlist?

# Possible Domains

- oursounds.io
- tunestogether.io
- ourplaylists.io
- soundstogether.io
- playliststogether.com

(.com: 8.88/year, .io: 32/year)

# SQL stuff

```
SELECT r.request_id, r.request_type, r.song_id, r.created_at, COUNT(*)
FROM song_requests as r LEFT JOIN request_votes as v
                                  ON r.request_id = v.request_id
WHERE r.playlist_id = "playlist1" AND r.status = "pending"
GROUP BY v.request_id;


SELECT request_id, COUNT(*)
FROM request_votes
GROUP BY request_id;
```