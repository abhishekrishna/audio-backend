AudioAppBackend
Tables:

Authors:

AuthorID (INT, Primary Key)
Name (VARCHAR(255))
Bio (TEXT)
Website (VARCHAR(255))
Audiobooks:

AudiobookID (INT, Primary Key)
Title (VARCHAR(255))
Description (TEXT)
CoverImage (VARCHAR(255))
AuthorID (INT, Foreign Key references Authors.AuthorID)
IsComplete (BOOLEAN)
Episodes:

EpisodeID (INT, Primary Key)
AudiobookID (INT, Foreign Key references Audiobooks.AudiobookID)
Title (VARCHAR(255))
Duration (INT) (in seconds)
FilePath (VARCHAR(255)) (path to audio file)
EpisodeNumber (INT)
IsFree (BOOLEAN)
Users:

UserID (INT, Primary Key)
Username (VARCHAR(255), Unique)
Email (VARCHAR(255), Unique)
Password (VARCHAR(255)) (hashed and secured)
Purchases:

PurchaseID (INT, Primary Key)
UserID (INT, Foreign Key references Users.UserID)
EpisodeID (INT, Foreign Key references Episodes.EpisodeID)
PurchaseDate (DATETIME)
PlaybackProgress:

UserID (INT, Foreign Key references Users.UserID)
EpisodeID (INT, Foreign Key references Episodes.EpisodeID)
LastPlayedPosition (INT) (in seconds)
Relationships:

One Author can have Many Audiobooks (One-to-Many)
One Audiobook can have Many Episodes (One-to-Many)
One User can have Many Purchases (One-to-Many) and Many Playback Progress entries (One-to-Many)
One Episode can belong to One Audiobook (Many-to-One)
One Purchase is for One User and One Episode (Many-to-Many)
One Playback Progress entry is for One User and One Episode (Many-to-Many)
