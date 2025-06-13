# Getting started to contribute

```
git clone <github url>

cd <repo name>

npm install

```

# For database

To generate migration
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

> > > > > > > 4084e30 (chore: install package.json to match well with package-lock.json)
