> This project is in the initial stages of development and is not yet functional. Feel free  to look around and play with the code.
> 
> You might also be interested in checking out the companion exploration packages at https://github.com/athkishore/chikkadb-journey

# Introduction

ChikkaDB is a server application providing translation layer around [SQLite](https://sqlite.org/) that enables you to use SQLite as a MongoDB-compatible JSON database. You can connect to ChikkaDB using any of your favourite MongoDB clients or language drivers.

The name of the project is a tribute to the beautiful city of Bengaluru in the diverse southern Indian state of Karnataka, where this project was born. 'Chikka' in Kannada means 'small', 'little', 'young' (as in younger sibling), etc.

The idea for this project is the result of my frustration at mongod being restricted to a narrow range of environments. For a while, I was hopeful that [FerretDB](https://www.ferretdb.com/) would fill the gap, but with v2 they have completely dropped the SQLite backend to focus on Postgres.

# Compatibility with MongoDB

ChikkaDB aims to implement a rich subset of the MongoDB commands that unlock the power of SQLite's JSON and JSONB functions. It doesn't aim for completeness in compatibility, since MongoDB has some obscure commands. The selection of commands and operators is based on the expressive value they add in interacting with JSON data stored in SQLite. 

The ChikkaDB server is wire-compatible with `mongod`, so you can connect to ChikkaDB using any of your favourite MongoDB clients or language drivers.

ChikkaDB looks at data from the lens of JSON, like SQLite does, so it doesn't aim for BSON-compatibility. There are significant differences, especially when it comes to comparison of values of different types, but these should not be a big issue in practice. A lot of people use MongoDB simply as a JSON database, without being aware of the complexity of BSON types. In such cases, ChikkaDB aspires to be a drop-in replacement.

# Architecture

## Betting on SQLite JSONB
ChikkaDB looks to leverage SQLite's native JSONB storage format and its powerful associated functions as fully as possible. The overarching approach is to translate MongoDB Query Language documents into SQL statements. 

While this might seem unwieldy, in practice I have found it possible to write equivalent SQL for even complex MongoDB queries and aggregation pipelines. The inbuilt [SQLite JSONB library](https://sqlite.org/json1.html) is versatile and provides functions that cover most if not all cases in manipulating JSON. With the addition of jsonb_each and jsonb_tree in v3.51.0, processing JSON data in SQLite has become ultra-fast.

The challenge seems to be to implement the translation layer well. It is possible that there are some rough edges that I haven't encountered yet, but it seems unlikely there could be problems that can't be solved through custom extensions even if they might not be amenable to being expressed in SQL.

## Major Components
1. **TCP server** that handles communication with MongoDB Client 
2. **MongoDB Query Language parser** that converts the query into a *canonical syntax tree*
3. **Backend** that translates the canonical syntax tree into SQLite dialect, connects to an SQLite database, and executes the query

This design choice leaves room for extensions and variants in the future. For example, ChikkaDB could possibly be used as an embedded library, as a thin wrapper around SQLite, without the TCP server. Or maybe if there is some other backend implementation that can receive and process the query in the form of the canonical syntax tree, it could be used without SQLite.


# Roadmap

The first version will be written in Typescript (the only language I'm fluent in currently). The aim is to implement enough database commands to support basic CRUD functionality. Each document will be stored in a single JSON field in an SQLite table.

If this turns out to be successful, I have a more ambitious plan of reimplementing the server in C (or more realistically Rust), to make it more performant. As it is, ChikkaDB only translates MongoDB commands to SQL and SQLite does all the heavy lifting, so performance shouldn't be much of an issue.

A more detailed roadmap will be made available as the project evolves.

# License

In the spirit of SQLite, the code for this project too will be in the public domain.

# Fun Project, Serious Project

This is first and foremost a project for me to have fun learning new things I would otherwise not have explored. At the same time, I see that it can fill a gap that is currently not served by any existing solution out there, if it turns out half as well as I hope it will.

There are intresting projects such as [LiteDB](https://www.litedb.org/), [Doclite](https://github.com/dwgebler/doclite), etc. but a lightweight mongod substitute that can talk to MongoDB clients is something different and will be so awesome to have.

Putting it out there even at this early stage in the spirit of building in public. I plan to document my journey on my [blog](https://akishore.in/blog). The journey matters as much as the outcome.

- [2025-10-31 Part 1: Talking to mongod](https://akishore.in/posts/2025-10-31-talking-to-mongod)
- [2025-11-07 Part 2: Eavesdropping on the Wire](https://akishore.in/posts/2025-11-07-eavesdropping-on-wire)
- [2025-11-16 Part 3: Decoding Wire Messages](https://akishore.in/posts/2025-11-16-decoding-wire-messages)