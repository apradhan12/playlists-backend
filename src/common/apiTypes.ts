import {RequestStatus} from "./commonTypes";

export interface AccessToken {
    accessToken: string;
}

export interface Tokens {
    access_token: string;
    refresh_token: string;
}

export interface SongRequestList {
    addRequests: SongRequest[];
    removeRequests: SongRequest[];
}

export interface SongRequest {
    songId: string;
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

export interface UserUpdateList {
    usersToAdd: string[];
    usersToRemove: string[];
}

export interface DeletionTimestamp {
    deleteAt: Date;
}

export interface SongRequestStatusUpdate {
    status: RequestStatus;
}
