import {RequestStatus} from "./commonTypes";

export interface SongRequest {
    request_id: number;
    playlist_id: string;
    request_type: RequestType;
    song_id: string;
    created_at: Date;
    request_status: RequestStatus;
    delete_at?: Date;
}

export enum RequestType {
    Add = "add",
    Remove = "remove"
}

export interface RequestVote {
    vote_id: number;
    request_id: number;
    user_id: string;
}

export interface Administrator {
    record_id: number;
    playlist_id: string;
    user_id: string;
}

export interface User {
    user_id: string;
    access_token: string;
    refresh_token: string;
}
