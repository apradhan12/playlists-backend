what happens to users' votes on a playlist when they become admins?
options:
- remove vote
- keep vote, but don't provide any indication


- Show playlists you manage somewhere (homepage)? we will need a route for this
- figure out what to do in case of API limits (rate limit, or max number of tracks to provide data about, etc.)


options:
- when you log in, keep track of playlist IDs you administrate, and use that to show options
- when you request a playlist page or a requests page, return isAdmin

- What data should be maintained about your login?
  - refresh token
  - access token
  - display name
  - user ID
  - playlists you administrate
  - homepage data??? - playlists you follow etc.
