To generate migration
```npm run typeorm -- migration:generate src/migration/InitialMigration -d src/config/database.ts```

Apply generation migration, run this command
```npm run typeorm -- migration:run -d src/config/database.ts```

For production, to revert migration
```npm run typeorm -- migration:revert -d src/config/database.ts```

Start the server locally ```npm run dev```
For production ```npm start```