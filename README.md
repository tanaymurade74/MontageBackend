# Montage – Backend

A REST API for a photo album app. It handles Google sign-in, album management and sharing, and image uploads to Cloudinary with tags, favorites, and comments. Built with Express, Node.js, MongoDB, and Cloudinary.

## Live API

[https://montagebackend.onrender.com](https://montagebackend.onrender.com)

> Base URL for all endpoints below. When running locally, the server uses `http://localhost:3000`.

## Quick Start

```bash
git clone https://github.com/tanaymurade74/MontageBackend.git
cd MontageBackend
npm install
```

Create a `.env` file in the project root:

```env
MONGODB=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
CLOUDINARY_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
GOOGLE_CLIENT_ID=your_google_oauth_client_id
GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret
```

Then start the server:

```bash
node index.js     # runs on http://localhost:3000
```

> The CORS origin and the Google OAuth redirect URIs are hardcoded to the production URLs in `index.js`. To run locally, update those to your local frontend/backend URLs. A Cloudinary account and Google OAuth credentials are required.

## Technologies

* Node.js
* Express
* MongoDB
* Mongoose
* Cloudinary
* Multer
* JWT (jsonwebtoken)
* Google OAuth 2.0

## Features

**Authentication**

* Sign in with Google (OAuth 2.0)
* JWT issued on login and required for all album/image routes

**Albums**

* Create albums, list your own, and list albums shared with you
* Update an album's description
* Share an album with other users by email
* Delete an album (also removes its images)

**Images**

* Upload images to an album, stored on Cloudinary (max 5MB; PNG, JPEG, GIF)
* List images in an album and filter by tags
* Mark images as favorites and view a favorites-only list
* Comment on images
* Delete images

## API Reference

Base URL: the live API above, or `http://localhost:3000`. All album and image routes require an `Authorization: Bearer <token>` header.

### GET /auth/login
Redirects to Google to begin sign-in.

### GET /auth/google/callback
OAuth callback — creates/finds the user, issues a JWT, and redirects to the frontend.

### GET /auth/me
Returns the authenticated user's ID. Sample Response: `{ userId }`

### POST /album
Create an album. Body: `name`, `description`. Sample Response: `{ Album: { _id, name, ownerId } }`

### GET /albums · GET /albums/shared · GET /albums/:albumId
List albums you own, albums shared with you, or fetch a single album.

### PATCH /albums/:albumId
Update an album's description (owner only).

### POST /albums/:albumId/share
Share an album with users by email (owner only). Body: `{ emails: ["a@x.com"] }`

### DELETE /albums/:albumId
Delete an album and all its images (owner only).

### POST /albums/:albumId/images
Upload an image (multipart form-data, field `image`) to Cloudinary (owner only). Sample Response: `{ imageUrl }`

### GET /albums/:albumId/images · GET /albums/:albumId/images/favorites
List images in an album, or favorites only. Both accept an optional `?tags=tag1,tag2` filter.

### PATCH /albums/:albumId/images/:imageId/favorite
Toggle an image's favorite status. Body: `{ isFavorite }`

### POST /albums/:albumId/images/:imageId/comments
Add a comment to an image. Body: `{ comment }`

### DELETE /albums/:albumId/images/:imageId
Delete an image (owner only).
