export class BaseGraphDriver {
    uri;
    username;
    password;
    database;
    constructor(uri, username, password, database) {
        this.uri = uri;
        this.username = username;
        this.password = password;
        this.database = database;
    }
    formatQuery(query) {
        return query.trim().replace(/\s+/g, ' ');
    }
}
