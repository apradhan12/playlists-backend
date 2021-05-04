CREATE TABLE song_requests (
    request_id INT NOT NULL AUTO_INCREMENT,
    playlist_id VARCHAR(50) NOT NULL,
    request_type ENUM('add', 'remove') NOT NULL,
    song_id VARCHAR(50) NOT NULL,
    PRIMARY KEY (request_id)
);

CREATE TABLE request_votes (
	request_id INT NOT NULL,
    user_id VARCHAR(50) NOT NULL,
	FOREIGN KEY (request_id) REFERENCES song_requests(request_id)
);

ALTER TABLE song_requests ADD created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE request_votes ADD (
	vote_id INT NOT NULL AUTO_INCREMENT,
    PRIMARY KEY (vote_id)
);

CREATE TABLE administrators (
    record_id INT NOT NULL AUTO_INCREMENT,
    playlist_id VARCHAR(50) NOT NULL,
    user_id VARCHAR(50) NOT NULL,
    PRIMARY KEY (record_id)
);

ALTER TABLE song_requests ADD (
    status ENUM('pending', 'approved', 'rejected') NOT NULL,
    delete_at DATETIME
);

CREATE TABLE users (
    user_id VARCHAR(50) NOT NULL,
    access_token VARCHAR(512) NOT NULL,
    refresh_token VARCHAR(512) NOT NULL,
    PRIMARY KEY (user_id)
);
