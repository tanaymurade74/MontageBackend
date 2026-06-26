const mongoose = require("mongoose");

const albumSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    description: {
        type: String
    },
    ownerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "MontageUser",
        required: true
    },
    sharedWith: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "MontageUser"
    }]
});

const Album = mongoose.model("Album", albumSchema);
module.exports = Album;