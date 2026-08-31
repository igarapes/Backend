import express from "express";

const app = express();

app.use(express.json());

app.get("/", (req,res) => {
    res.json({message:"ola"});
});

const port = process.env.PORT;

app.listen(port, () => {
    console.log("'servidor rodando");
})