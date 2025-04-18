To generate migration
```npm run typeorm -- migration:generate src/migration/InitialMigration -d src/config/database.ts```

Apply generation migration, run this command
```npm run typeorm -- migration:run -d src/config/database.ts```

For production, to revert migration
```npm run typeorm -- migration:revert -d src/config/database.ts```

If you migrate your db, and changes were made, delete the dist folder
Run ``npm build``

Start the server ```npm start```