import { Request, Response } from "express";

const knex = require('knex')({
    client: "mysql2",
    connection: {
        host: "localhost",
        port: 3306,
        user: "root",
        password: process.env.DATABASE_PASSWORD,
        database: 'playlists_app'
    }
});
const express = require("express");

const app = express();
module.exports = app;

app.get("/requests/:playlistId", (req: Request, res: Response) => {
    knex.select().from("song_requests")
        .where({
            playlist_id: req.params.playlistId
        })
        .then((rows: any) => {
            res.send(rows);
        });
});

app.post("/requests/:playlistId", (req: Request, res: Response) => {

});