const mongoose = require("mongoose");

const imageSchema = new mongoose.Schema({
    albumId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Album",
        required: true
    },
    name: {
        type: String,
        required: true
    },
    tags: [{
        type: String
    }],
    person: {
        type: String
    },
    isFavorite: {
        type: Boolean,
        default: false
    },
    comments: [{
        text: {
            type: String,
            required: true
        },
        author: {
            type: mongoose.Schema.Types.ObjectId, ref: "MontageUser"
        },
        createdAt:{
            type: Date,
            default: Date.now
        }
    }],
    size: {
        type: Number
    },
    imageUrl: {
        type: String,
        required: true
    },
    uploadedAt: {
        type: Date,
        default: Date.now
    }
});

const Image = mongoose.model("Image", imageSchema);
module.exports = Image;