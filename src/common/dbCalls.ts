import {db} from "./database.js";

export async function getPlaylistAdministrators(playlistId: string): Promise<string[]> {
    const rows = await db.select(["user_id"]).from("administrators").where({"playlist_id": playlistId});
    return rows.map(row => row.user_id);
}
