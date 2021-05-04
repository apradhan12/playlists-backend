import "./loadEnv.js"
import cors from "cors";
import cookieParser from "cookie-parser";
import express from "express";
import baseRouter from "./routes/index.js";

const app = express();

app.use('/', baseRouter);

// .use(express.static(__dirname + '/../public'))
app.use(cors())
   .use(cookieParser());

console.log('Listening on 8888');
app.listen(8888);
