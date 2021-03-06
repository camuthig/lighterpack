use lighterpack

db.migrations.insert({"num": 1});

db.createUser({user:"writetApp", pwd:"writeApp5299", roles:[{role:"dbOwner", db:"writeapp"}]});
