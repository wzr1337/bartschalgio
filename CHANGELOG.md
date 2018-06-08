<a name="0.1.0"></a>
# 0.1.0 (2018-06-08)


### Bug Fixes

* fix mapping of isActive to 0 or 1 on GPIO ([8ab7ec4](https://github.com/wzr1337/bartschlagio/commit/8ab7ec4))
* **config:** config folder evaluation ([24d4c42](https://github.com/wzr1337/bartschlagio/commit/24d4c42))
* **config:** set correct gpio ([7051e1d](https://github.com/wzr1337/bartschlagio/commit/7051e1d))
* **events:** use correct env to differentiate between dev and prod for event logging ([06dbe98](https://github.com/wzr1337/bartschlagio/commit/06dbe98))
* **macthSprinkler:** use regular function instead of fat arrow syntax to preserve this pointer ([273b4ff](https://github.com/wzr1337/bartschlagio/commit/273b4ff))
* **sprinklers:** correct info and error reporting ([dd6a988](https://github.com/wzr1337/bartschlagio/commit/dd6a988))


### Features

* **auth:** add auth service, allow user password logn ([5c0766c](https://github.com/wzr1337/bartschlagio/commit/5c0766c))
* **config:** add external convfiguration file ([229d04e](https://github.com/wzr1337/bartschlagio/commit/229d04e))
* **events:** add error reporting for missing sprinkler property, refactor response ([a62ed9c](https://github.com/wzr1337/bartschlagio/commit/a62ed9c))
* **events:** add remote logging ([dc83839](https://github.com/wzr1337/bartschlagio/commit/dc83839))
* **events:** differentiate between dev and prod for event logging ([075e2d8](https://github.com/wzr1337/bartschlagio/commit/075e2d8))
* **events:** log start and end time instead of duration ([dd55e2a](https://github.com/wzr1337/bartschlagio/commit/dd55e2a))
* **general:** add config templates ([a303182](https://github.com/wzr1337/bartschlagio/commit/a303182))
* **gpio2rest:** add some logging, rename app.js to gpio2rest.js ([84f816e](https://github.com/wzr1337/bartschlagio/commit/84f816e))
* **index:** use config instead of hardcode ([0961e48](https://github.com/wzr1337/bartschlagio/commit/0961e48))
* **init:** initialize with respeting is ActiveByDefault settings, read actual state on GET before response ([12d5f33](https://github.com/wzr1337/bartschlagio/commit/12d5f33))
* **logging:** add timed logging ([ad5c38d](https://github.com/wzr1337/bartschlagio/commit/ad5c38d))
* **middleware:** log queries ([1067f7a](https://github.com/wzr1337/bartschlagio/commit/1067f7a))
* **mock:** add readSnyc ([73aa893](https://github.com/wzr1337/bartschlagio/commit/73aa893))
* **package:** add a start script ([a95112a](https://github.com/wzr1337/bartschlagio/commit/a95112a))
* **REST:** add a rest API ([edfd3b6](https://github.com/wzr1337/bartschlagio/commit/edfd3b6))
* **serialization:** filter response before sending it out ([bce2c31](https://github.com/wzr1337/bartschlagio/commit/bce2c31))
* **sprinklers:** add auto shut-off for individual sprinklers (configurable) ([b4be50a](https://github.com/wzr1337/bartschlagio/commit/b4be50a))
* **sprinklers:** add timiing info ([b8bbf3c](https://github.com/wzr1337/bartschlagio/commit/b8bbf3c))
* **TLS:** add https functionality ([ca5bc02](https://github.com/wzr1337/bartschlagio/commit/ca5bc02))



