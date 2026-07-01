const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const bodyParser = require("body-parser");
const axios = require("axios");
const cloudinary = require("cloudinary").v2;
const path = require("path");
const fs = require("fs");
require("dotenv").config();

const corsOptions = {
  origin: "https://montage-frontend.vercel.app",
};

const initializeDatabase = require("./db.connect.js");

const User = require("./models/MontageUser.model");
const Album = require("./models/Album.model");
const Image = require("./models/Image.model");

const app = express();
app.set("trust proxy", 1);
app.use(cors(corsOptions));
app.use(cookieParser());
app.use(express.json());
app.use(bodyParser.json());

initializeDatabase();

const storage = multer.diskStorage({});
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: function (req, file, cb) {
    let allowedExt = [".png", ".jpeg", ".jpg", ".gif"];
    let allowedType = ["image/png", "image/jpeg", "image/gif"];

    let ext = path.extname(file.originalname).toLowerCase();
    let mimeType = file.mimetype;

    if (allowedExt.includes(ext) && allowedType.includes(mimeType)) {
      return cb(null, true);
    } else {
      return cb(new Error("Only .png file type is allowed"), false);
    }
  },
});

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: "No token provided" });

  const token = authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No token provided" });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid token" });
  }
};

app.get("/auth/me", verifyToken, async (req, res) => {
  res.json({ userId: req.user.userId });
});

app.get("/auth/login", async (req, res) => {
  const googleUrl = `https://accounts.google.com/o/oauth2/auth?client_id=${process.env.GOOGLE_CLIENT_ID}&redirect_uri=https://montagebackend.onrender.com/auth/google/callback&response_type=code&scope=profile email`;
  res.redirect(googleUrl);
});

app.get("/auth/google/callback", async (req, res) => {
  const { code } = req.query;
  if (!code) {
    return res.status(400).json({ message: "Authorization code not provided" });
  }
  try {
    const googleTokenResponse = await axios.post(
      "https://oauth2.googleapis.com/token",
      new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        code,
        redirect_uri: "https://montagebackend.onrender.com/auth/google/callback",
        grant_type: "authorization_code",
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      },
    );

    const googleAccessToken = googleTokenResponse.data.access_token;

    const profileResponse = await axios.get(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      {
        headers: {
          Authorization: `Bearer ${googleAccessToken}`,
        },
      },
    );

    const email = profileResponse.data.email;

    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({ email });
    }

    const jwtToken = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: "12h",
    });

   res.redirect(`https://montage-frontend.vercel.app/oauth-success?token=${jwtToken}`);
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Google authentication failed" });
  }
});

// app.post("/auth/logout", async (req, res) => {
//   res.clearCookie("token");
//   return res.status(200).json({ message: "User logged out." });
//   // res.redirect(`http://localhost:3001`)
// });

const hasAccess = (album, user) => {
  return (
    album.ownerId.equals(user.userId) ||
    album.sharedWith.some((id) => id.equals(user.userId))
  );
};

app.post("/album", verifyToken, async (req, res) => {
  const { name, description } = req.body;
  if (!name) {
    return res.status(400).json({ message: "Name is required" });
  }

  try {
    const newAlbum = new Album({ name, description, ownerId: req.user.userId });
    await newAlbum.save();
    return res.status(201).json({ Album: newAlbum });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ Error: "Error while creating the album", error });
  }
});

app.patch("/albums/:albumId", verifyToken, async (req, res) => {
  try {
    const album = await Album.findById(req.params.albumId);
    if (!album) return;
    if (!album.ownerId.equals(req.user.userId))
      return res
        .status(403)
        .json({ error: "Only the owner can update this album." });

    album.description = req.body.description;
    await album.save();
    res.json(album);
  } catch (error) {
    res.status(500).json({ error: "Failed to update album." });
  }
});

app.get("/albums", verifyToken, async (req, res) => {
  try {
    const albums = await Album.find({ ownerId: req.user.userId }).populate(
      "ownerId",
      "email",
    );
    res.status(200).json(albums);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch albums." });
  }
});

app.get("/albums/shared", verifyToken, async (req, res) => {
  try {
    const albums = await Album.find({ sharedWith: req.user.userId }).populate(
      "sharedWith",
      "email",
    );
    return res.status(200).json(albums);
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch albums" });
  }
});

app.get("/albums/:albumId", verifyToken, async (req, res) => {
  try {
    const album = await Album.findById(req.params.albumId);
    if (!album) {
      return res.status(404).json({ message: "Album not found" });
    }
    return res.status(200).json(album);
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch album." });
  }
});

app.post("/albums/:albumId/share", verifyToken, async (req, res) => {
  try {
    const album = await Album.findById(req.params.albumId);
    if (!album) return;
    if (!album.ownerId.equals(req.user.userId))
      return res
        .status(403)
        .json({ error: "Only the owner can share this album." });

    const { emails } = req.body;
    const existingUsers = await User.find({ email: { $in: emails } });
    const existingEmails = existingUsers.map((u) => u.email);
    const unknownEmails = emails.filter((e) => !existingEmails.includes(e));

    if (unknownEmails.length > 0)
      return res
        .status(400)
        .json({ error: "User does not exist.", unknownEmails });

    existingUsers.forEach((user) => {
      if (!album.sharedWith.some((id) => id.equals(user._id)))
        album.sharedWith.push(user._id);
    });
    await album.save();
    res.json(album);
  } catch (error) {
    res.status(500).json({ error: "Failed to share album." });
  }
});

app.delete("/albums/:albumId", verifyToken, async (req, res) => {
  try {
    const album = await Album.findById(req.params.albumId);
    if (!album)
      return res.status(400).json({ message: "Album does not exist" });
    if (!album.ownerId.equals(req.user.userId))
      return res
        .status(403)
        .json({ error: "Only the owner can delete this album." });

    await Image.deleteMany({ albumId: req.params.albumId });
    await Album.deleteOne({ _id: req.params.albumId });
    res.status(200).json({ message: "Album deleted." });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete album." });
  }
});

app.get("/albums/:albumId/images/favorites", verifyToken, async (req, res) => {
  try {
    const album = await Album.findById(req.params.albumId);
    if (!album) return res.status(400).json({ message: "Album not present" });
    // if (!hasAccess(album, req.user))
    //     return res.status(403).json({ error: "You do not have access to this album." });
    const filter = { albumId: req.params.albumId, isFavorite: true };
    if (req.query.tags) {
        let terms = req.query.tags.split(",").map(tag => tag.trim()).filter(Boolean);
        if(terms.length > 0){
      filter.tags = { $in: terms.map(t => new RegExp(t, "i")) };
        }
    }
    const images = await Image.find(filter).populate(
      "comments.author",
      "email",
    );
    res.status(200).json(images);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch favorites." });
  }
});

app.post(
  "/albums/:albumId/images",
  verifyToken,
  upload.single("image"),
  async (req, res) => {
    try {
      const album = await Album.findById(req.params.albumId);
      if (!album)
        return res.status(400).json({ message: "Album does not exist." });

      if (!album.ownerId.equals(req.user.userId)) {
        return res
          .status(500)
          .json({ message: "Only owner of the album can add images." });
      }

      const file = req.file;
      if (!file) return res.status(400).json({ message: "File not provided" });

      const cloudinaryResponse = await cloudinary.uploader.upload(file.path, {
        folder: "Montage",
      });

      const { tags, person, isFavorite } = req.body;

      let parsedTags = [];
      if (tags) {
        parsedTags = tags.split(",").map((tag) => tag.trim());
      }

      const newImage = new Image({
        name: file.originalname,
        albumId: req.params.albumId,
        tags: parsedTags,
        isFavorite,
        person,
        imageUrl: cloudinaryResponse.secure_url,
        // size: fs.statSync(file.path).size()
        size: file.size,
      });

      await newImage.save();
      return res.status(201).json({ imageUrl: cloudinaryResponse.secure_url });
    } catch (error) {
      console.log(error);
      return res
        .status(500)
        .json({ message: "Error while trying to add image" });
    }
  },
);

app.get("/albums/:albumId/images", verifyToken, async (req, res) => {
  try {
    const album = await Album.findById(req.params.albumId);
    if (!album) return;
    // if (!hasAccess(album, req.user))
    //     return res.status(403).json({ error: "You do not have access to this album." });

    const filter = { albumId: req.params.albumId };
    if (req.query.tags) {
      let terms = req.query.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
      if (terms.length > 0) {
        filter.tags = { $in: terms.map((t) => new RegExp(t, "i")) };
      }
    }
    const images = await Image.find(filter).populate(
      "comments.author",
      "email",
    );
    res.status(200).json(images);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch images." });
  }
});

app.patch(
  "/albums/:albumId/images/:imageId/favorite",
  verifyToken,
  async (req, res) => {
    try {
      const album = await Album.findById(req.params.albumId);
      if (!album) return;
      // if (!album.ownerId.equals(req.user.userId))
      //     return res.status(403).json({ error: "Only the owner can modify this image." });

      const image = await Image.findByIdAndUpdate(
        req.params.imageId,
        { $set: { isFavorite: req.body.isFavorite } },
        { new: true },
      ).populate("comments.author", "email");
      if (!image) return res.status(404).json({ error: "Image not found." });
      res.status(200).json(image);
    } catch (error) {
      console.log(error);
      res.status(500).json({ error: "Failed to update image." });
    }
  },
);

app.post(
  "/albums/:albumId/images/:imageId/comments",
  verifyToken,
  async (req, res) => {
    try {
      const album = await Album.findById(req.params.albumId);
      if (!album) return;
      // if (!album.ownerId.equals(req.user.userId))
      //     return res.status(403).json({ error: "Only the owner can comment on this image." });

      const image = await Image.findByIdAndUpdate(
        req.params.imageId,
        {
          $push: {
            comments: { text: req.body.comment, author: req.user.userId },
          },
        },
        { new: true },
      ).populate("comments.author", "email");
      if (!image) return res.status(404).json({ error: "Image not found." });
      res.status(200).json(image);
    } catch (error) {
      res.status(500).json({ error: "Failed to add comment." });
    }
  },
);

app.delete(
  "/albums/:albumId/images/:imageId",
  verifyToken,
  async (req, res) => {
    try {
      const album = await Album.findById(req.params.albumId);
      if (!album) return;
      if (!album.ownerId.equals(req.user.userId))
        return res
          .status(403)
          .json({ error: "Only the owner can delete this image." });

      const image = await Image.findOneAndDelete({
        _id: req.params.imageId,
        albumId: req.params.albumId,
      });
      if (!image) return res.status(404).json({ error: "Image not found." });
      res.status(200).json({ message: "Image deleted." });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete image." });
    }
  },
);

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE")
      return res
        .status(400)
        .json({ message: "File size exceeds limit of 5MB." });
    else return res.status(400).json({ message: err.message });
  }
  if (err) {
    return res.status(400).json({ message: err.message });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log("Server running on port 3000");
});
