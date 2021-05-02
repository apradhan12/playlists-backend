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
