import "./loadEnv.js"
import cors from "cors";
import cookieParser from "cookie-parser";
import express from "express";
import baseRouter from "./routes/index.js";
import {handleErrors} from "./common/handleErrors.js";

const app = express();

// add middleware before routes, except for error handling
app.use(cors())
    .use(cookieParser())
    .use(express.json());

app.use('/', baseRouter);

app.use(handleErrors);

console.log('Listening on 8888');
app.listen(8888);
