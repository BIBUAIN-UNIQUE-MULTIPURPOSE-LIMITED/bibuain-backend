# Getting started to contribute

```
git clone <github url>

cd <repo name>

npm install

```

# For database

To generate migration

To generate migration
`npm run typeorm -- migration:generate src/migration/InitialMigration -d src/config/database.ts`

Apply generation migration, run this command
`npm run typeorm -- migration:run -d src/config/database.ts`

For production, to revert migration
`npm run typeorm -- migration:revert -d src/config/database.ts`

`npm run migration:generate`

Apply generation migration, run this command
`npm run migration:run`

To revert migration (if applicable, _please be careful when reverting, only revert when needed_)
`npm run typeorm -- migration:revert -d src/config/database.ts`

# To run server

`npm run dev`

# For code formatting

`npm run format`

# To check lint error

<<<<<<< HEAD
`npm run lint`
=======

`npm run lint`
