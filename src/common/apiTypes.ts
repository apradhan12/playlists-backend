import {RequestStatus} from "./commonTypes";

export interface AccessToken {
    accessToken: string;
}

export interface Tokens {
    access_token: string;
    refresh_token: string;
}

export interface SongList {
    areYouAdmin: boolean;
    songs: Song[];
}

export interface Song {
    title: string;
    artist: string;
    album: string;
    dateAdded: string;
    duration: number;
}

export interface SongRequestList {
    areYouAdmin: boolean;
    addRequests: SongRequest[];
    removeRequests: SongRequest[];
}

export interface SongRequest {
    requestId: number;
    title: string;
    artist: string;
    album: string;
    dateAdded: string;
    duration: number;
    numVotes: number;
    hasYourVote: boolean;
}

export interface SongUpdateList {
    songsToAdd: string[];
    songsToRemove: string[];
}

export interface PlaylistSongsDifference {
    songsAlreadyInPlaylist: string[];
    songsNotInPlaylist: string[];
}

export interface InvalidSongList {
    invalidSongIds: string[];
}

export interface UserUpdateList {
    usersToAdd: string[];
    usersToRemove: string[];
}

export interface DeletionTimestamp {
    deleteAt: string;
}

export interface SongRequestStatusUpdate {
    status: RequestStatus;
}

export interface UserList {
    owner: User;
    administrators: User[];
}

export interface User {
    userId: string;
    displayName: string;
}
