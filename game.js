let game;

const gameOptions = {
    dudeGravity: 800,
    dudeSpeed: 300,
    bulletSpeed: 600,
    shootDelay: 250,   // ms between shots
    startLives: 3
}

window.onload = function () {
    let gameConfig = {
        type: Phaser.AUTO,
        backgroundColor: "#112211",
        scale: {
            mode: Phaser.Scale.FIT,
            autoCenter: Phaser.Scale.CENTER_BOTH,
            width: 800,
            height: 1000,
        },
        pixelArt: true,
        physics: {
            default: "arcade",
            arcade: { gravity: { y: 0 } }
        },
        scene: PlayGame
    }

    game = new Phaser.Game(gameConfig)
    window.focus()
}

class PlayGame extends Phaser.Scene {

    constructor() {
        super("PlayGame")
    }

    preload() {
        this.load.image("ground", "assets/platform.png")
        this.load.image("star", "assets/star.png")
        this.load.spritesheet("dude", "assets/dude.png", { frameWidth: 32, frameHeight: 48 })
    }

    // Draw the extra sprites in code so no new image files are needed
    makeTextures() {
        const g = this.make.graphics({ x: 0, y: 0, add: false })

        if (!this.textures.exists("gem")) {          // blue gem = worth 5 points
            g.fillStyle(0x00aaff, 1)
            g.fillTriangle(10, 0, 20, 10, 10, 20)
            g.fillTriangle(10, 0, 0, 10, 10, 20)
            g.generateTexture("gem", 20, 20)
            g.clear()
        }
        if (!this.textures.exists("enemy")) {        // red monster
            g.fillStyle(0xff3333, 1)
            g.fillCircle(16, 16, 16)
            g.fillStyle(0xffffff, 1)
            g.fillCircle(10, 12, 5)
            g.fillCircle(22, 12, 5)
            g.fillStyle(0x000000, 1)
            g.fillCircle(10, 12, 2)
            g.fillCircle(22, 12, 2)
            g.generateTexture("enemy", 32, 32)
            g.clear()
        }
        if (!this.textures.exists("bullet")) {       // yellow bullet
            g.fillStyle(0xffee00, 1)
            g.fillCircle(5, 5, 5)
            g.generateTexture("bullet", 10, 10)
            g.clear()
        }
        g.destroy()
    }

    create() {
        this.makeTextures()

        this.score = 0
        this.lives = gameOptions.startLives
        this.lastShot = 0
        this.facing = 1
        this.invulnerable = false
        this.gameOver = false

        // Platforms
        this.groundGroup = this.physics.add.group({ immovable: true, allowGravity: false })
        for (let i = 0; i < 20; i++) {
            this.groundGroup.create(Phaser.Math.Between(0, game.config.width), Phaser.Math.Between(0, game.config.height), "ground")
        }

        // Player
        this.dude = this.physics.add.sprite(game.config.width / 2, game.config.height / 2, "dude")
        this.dude.body.gravity.y = gameOptions.dudeGravity
        this.physics.add.collider(this.dude, this.groundGroup)

        // Collectibles: stars (1 pt) and gems (5 pts)
        this.starsGroup = this.physics.add.group({ allowGravity: false })
        this.gemsGroup = this.physics.add.group({ allowGravity: false })
        this.physics.add.collider(this.starsGroup, this.groundGroup)
        this.physics.add.collider(this.gemsGroup, this.groundGroup)
        this.physics.add.overlap(this.dude, this.starsGroup, (d, s) => this.collect(s, 1), null, this)
        this.physics.add.overlap(this.dude, this.gemsGroup, (d, g) => this.collect(g, 5), null, this)

        // Enemies chase the player; bullets kill them
        this.enemies = this.physics.add.group({ allowGravity: false })
        this.bullets = this.physics.add.group({ allowGravity: false })
        this.physics.add.overlap(this.dude, this.enemies, this.hitByEnemy, null, this)
        this.physics.add.overlap(this.bullets, this.enemies, this.shootEnemy, null, this)

        // HUD
        this.add.image(16, 16, "star")
        this.scoreText = this.add.text(32, 3, "0", { fontSize: "30px", fill: "#ffffff" })
        this.livesText = this.add.text(game.config.width - 20, 3, "", { fontSize: "30px", fill: "#ff5555" }).setOrigin(1, 0)
        this.add.text(game.config.width / 2, 8, "Arrows: move/jump   SPACE: shoot", { fontSize: "16px", fill: "#aaaaaa" }).setOrigin(0.5, 0)
        this.updateLives()

        // Controls
        this.cursors = this.input.keyboard.createCursorKeys()
        this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)

        // Animations
        this.anims.create({ key: "left", frames: this.anims.generateFrameNumbers("dude", { start: 0, end: 3 }), frameRate: 10, repeat: -1 })
        this.anims.create({ key: "turn", frames: [{ key: "dude", frame: 4 }], frameRate: 10 })
        this.anims.create({ key: "right", frames: this.anims.generateFrameNumbers("dude", { start: 5, end: 9 }), frameRate: 10, repeat: -1 })

        // Timers
        this.time.addEvent({ callback: this.addGround, callbackScope: this, delay: 700, loop: true })
        this.time.addEvent({ callback: this.addEnemy, callbackScope: this, delay: 1500, loop: true })
    }

    addGround() {
        if (this.gameOver) return
        this.groundGroup.create(Phaser.Math.Between(0, game.config.width), 0, "ground")
        this.groundGroup.setVelocityY(gameOptions.dudeSpeed / 6)

        const roll = Phaser.Math.Between(0, 99)
        if (roll < 50) {
            this.starsGroup.create(Phaser.Math.Between(0, game.config.width), 0, "star")
            this.starsGroup.setVelocityY(gameOptions.dudeSpeed)
        } else if (roll < 70) {
            this.gemsGroup.create(Phaser.Math.Between(0, game.config.width), 0, "gem")
            this.gemsGroup.setVelocityY(gameOptions.dudeSpeed)
        }
    }

    addEnemy() {
        if (this.gameOver) return
        const e = this.enemies.create(Phaser.Math.Between(0, game.config.width), -20, "enemy")
        e.setVelocityY(120)
    }

    collect(item, points) {
        item.disableBody(true, true)
        this.addScore(points)
    }

    addScore(points) {
        this.score += points
        this.scoreText.setText(this.score)
    }

    updateLives() {
        this.livesText.setText("♥".repeat(Math.max(this.lives, 0)))
    }

    shoot() {
        const now = this.time.now
        if (now - this.lastShot < gameOptions.shootDelay) return
        this.lastShot = now
        const b = this.bullets.create(this.dude.x + 20 * this.facing, this.dude.y, "bullet")
        b.setVelocityX(gameOptions.bulletSpeed * this.facing)
    }

    shootEnemy(bullet, enemy) {
        bullet.destroy()
        enemy.destroy()
        this.addScore(2)
    }

    hitByEnemy(dude, enemy) {
        enemy.destroy()
        if (this.invulnerable) return
        this.loseLife()
    }

    loseLife() {
        this.lives--
        this.updateLives()
        this.cameras.main.shake(200, 0.01)

        if (this.lives <= 0) {
            this.gameOver = true
            this.physics.pause()
            this.dude.setTint(0xff0000)
            this.add.text(game.config.width / 2, game.config.height / 2, "GAME OVER\nScore: " + this.score + "\nPress SPACE to restart",
                { fontSize: "40px", fill: "#ffffff", align: "center" }).setOrigin(0.5)
            return
        }

        // Short invulnerability so one hit doesn't drain all lives
        this.invulnerable = true
        this.dude.setAlpha(0.4)
        this.time.delayedCall(1000, () => {
            this.invulnerable = false
            this.dude.setAlpha(1)
        })
    }

    // Remove things that have fallen off the screen
    cleanUp() {
        const limit = game.config.height + 50
        const groups = [this.groundGroup, this.starsGroup, this.gemsGroup, this.enemies]
        groups.forEach(group => {
            group.getChildren().slice().forEach(child => {
                if (child.y > limit) child.destroy()
            })
        })
        this.bullets.getChildren().slice().forEach(b => {
            if (b.x < -20 || b.x > game.config.width + 20) b.destroy()
        })
    }

    update() {
        if (this.gameOver) {
            if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) this.scene.start("PlayGame")
            return
        }

        // Movement
        if (this.cursors.left.isDown) {
            this.dude.body.velocity.x = -gameOptions.dudeSpeed
            this.dude.anims.play("left", true)
            this.facing = -1
        } else if (this.cursors.right.isDown) {
            this.dude.body.velocity.x = gameOptions.dudeSpeed
            this.dude.anims.play("right", true)
            this.facing = 1
        } else {
            this.dude.body.velocity.x = 0
            this.dude.anims.play("turn", true)
        }

        if (this.cursors.up.isDown && this.dude.body.touching.down) {
            this.dude.body.velocity.y = -gameOptions.dudeGravity / 1.6
        }

        // Shooting
        if (this.spaceKey.isDown) this.shoot()

        // Enemies drift towards the player
        this.enemies.getChildren().forEach(e => {
            e.setVelocityX(Phaser.Math.Clamp(this.dude.x - e.x, -80, 80))
        })

        this.cleanUp()

        // Falling out of the world costs a life and respawns the player
        if (this.dude.y > game.config.height || this.dude.y < 0) {
            this.dude.setPosition(game.config.width / 2, game.config.height / 2)
            this.dude.body.velocity.set(0, 0)
            this.loseLife()
        }
    }
}
