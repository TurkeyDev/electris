// JSDoc Wiki: http://en.wikipedia.org/wiki/JSDoc
// jsdoc3 tags: http://usejsdoc.org/#JSDoc3_Tag_Dictionary
// JS Data Types: http://www.w3schools.com/js/js_datatypes.asp
// How to express JS data types:
// https://developers.google.com/closure/compiler/docs/js-for-compiler#types

// The collision detection is mostly inspired from the article:
// http://gamedev.tutsplus.com/tutorials/implementation/implementing-tetris-collision-detection/
// (by Michael James Williams on Oct 6th 2012).
// The reason why I did not entirely come up with my own algorithms for
// everything is for the sake of time.

// Most of the standards I used for Tetris came from
// http://en.wikipedia.org/wiki/Tetris

/* Nomenclature:
 *
 * user:       Person playing the game.
 * Tet:        Short for Tetrimino (http://en.wikipedia.org/wiki/Tetrimino), or
 *             the name of our main class. I will try to disambiguate within the
 *             comments when necessary.
 * living Tet: Tet in free fall controlled by user.
 * landed Tet: Tet that has landed and is no longer in control by user.
 */

/** Represents our game board and interface */
class Game {
  // Public Vars
  /** Developer Mode (when enabled/true, test cases can be ran via keybinds) */
  devModeOn: boolean
  /**
   * Since the Tetris standard is to have 10 horizontal blocks by 16 vertical
   * blocks, this is a constant set to 16.
   */
  static readonly BOARD_ROW_NUM: number = 16
  /**
   * Since the Tetris standard is to have 10 horizontal blocks by 16 vertical
   * blocks, this is a constant set to 10.
   */
  static readonly BOARD_COL_NUM: number = 10
  /**
   * If true, we want to create a new Tet at the beginning of the loop
   * interval.
   * 
   * Defaults as true since we always want to create a new Tet at the beginning
   * of the game.
   */
  newTet: boolean = true
  /**
   * The Tet that's falling and being controlled by the player.
   * 
   * Defaults as null since we don't start off with any Tets the moment the game
   * gets intialized.
   */
  currentTet: Tet | null = null
  /**
   * The Tet that's going to come into play after the currentTet lands.
   * 
   * Defaults as null since we don't start off with any Tets the moment the game
   * gets intialized.
   */
  nextTet: Tet | null = null
  /**
   * If true, we should update our landed array to be used in collision
   * detection.
   */
  updateLanded: boolean = true
  /** This is the array of all Tets that are in the game. */
  allTets: Tet[] = []
  /**
   * This is the array of all Tets that need to be removed before being drawn.
   */
  tetsToRemove: number[] = []
  /** This is the score that we're going to use to display. */
  score: number = 0
  /**
   * This is the boolean we check to see if we should update our high score list
   * or not.
   */
  updateScore: boolean = true
  /** TODO: Add comment */
  loop: NodeJS.Timer
  /** TODO: Add comment */
  dropOnce: boolean

  // Private vars
  /**
   * This is the interval, in milliseconds, for which our currentTet is going to
   * drop 1 block.
   */
  private dropInterval: number = 750
  /**
   * The flag that indicates when the game is over. When true, we handle the
   * "game over" events.
   */
  private gameOver: boolean = false
  /**
   * This is the width that we set. This width can be adjusted and our game will
   * scale to it.
   */
  private canvasWidth: number = 200
  /** This is the length of the side of each "block" on the game, in pixels. */
  private blockS: number
  /** This is the DOM element for which we are going to be drawing on. */
  private canvas: HTMLCanvasElement
  /**
   * This is the height of the panel which houses our score, nextTet, and
   * PAUSED/DEV text.
   */
  private panelHeight: number
  /**
   * This is the array of array of numbers which we are going to populate with
   * our allTets to be able to detect Tet collision.
   */
  private landed: number[][] = []
  /** TODO: Add comment */
  private paused: boolean = true
  /**
   * This is the name of the high score list DOM element for which we are going
   * to show our user their past high scores.
   */
  private highScoresListId: string

  /**
   * Represents all of the functions which generate and control the game board.
   * We use the {@link Tet} class to manipulate our Tets.
   * @param canvasId This is the id of the canvas element within the document
   *     from which this Game class was created.
   * @param highScoresListId This is the id of the list for which we are going
   *     to list out the user's past high scores.
   * @param [devMode] This is the option to set the game to be initially in
   *     Developer's Mode.
   */
  constructor(canvasId: string, highScoresListId: string, devModeOn = false) {
    // Force instantiation
    if (!(this instanceof Game)) {
      return new Game(canvasId, highScoresListId, devModeOn)
    }

    // TODO: Add ability to pass in {options}
    // this.dropInterval = 750
    // this.canvasWidth = 200

    this.canvas = <HTMLCanvasElement> document.getElementById(canvasId)
    this.canvas.width = this.canvasWidth
    this.canvas.height = 2 * this.canvasWidth

    this.highScoresListId = highScoresListId

    this.devModeOn = devModeOn
    
    // Assume block width and height will always be the same:
    this.blockS = this.canvasWidth / 10

    this.panelHeight = 
        Math.round((2 - Game.BOARD_ROW_NUM / Game.BOARD_COL_NUM) *
            this.canvasWidth)

    // Init functions
    this.displayHighScores()
    this.createTet()
    this.handleEvents()
  }

  /**
   * This method creates 3 event listeners (2 for the window and 1 for the
   * document). The 2 events for the window are onblur and onfocus. These will
   * pause the game when you leave the game window and resume it when you come
   * back. The event for the document listens for onkeydown events. These
   * basically allow the user to interact with the game.
   */
  handleEvents() {
    var that = this
    // Pause if we lose focus of the game. Resume once we get focus back. We
    // don't need the Page Visibility API because we don't have a resource
    // intensive game while it's idle
    var pausedBeforeBlur = true
    window.onblur = function () {
      if (that.gameOver === false) {
        pausedBeforeBlur = that.paused
        clearInterval(that.loop)
        that.paused = true
        that.draw()
      }
    }
    window.onfocus = function () {
      if (!pausedBeforeBlur && that.gameOver === false) {
        if (!that.gameOver) {
          that.tetDownLoop()
        }
        that.paused = false
        that.draw()
      }
    }
  
    // Handle key events
    // For keycodes: http://www.javascripter.net/faq/keycodes.htm
    document.onkeydown = function (e) {
      switch (e.keyCode) {
        case 32: // space to move living Tet all the way down
          if (that.canTetMove() === true) {
            while (!that.newTet && that.currentTet) {
              that.currentTet.moveDown()
            }
            that.draw()
            that.tetDownLoop()
          }
          break
        case 38: // up arrow to rotate Tet clockwise
          if (that.canTetMove() === true && that.currentTet) {
            that.currentTet.rotate()
            that.draw()
          }
          break
        case 37: // left arrow to move Tet left
          if (that.canTetMove() === true && that.currentTet) {
            that.currentTet.moveLeft()
            that.draw()
          }
          break
        case 39: // right arrow to move Tet right
          if (that.canTetMove() === true && that.currentTet) {
            that.currentTet.moveRight()
            that.draw()
          }
          break
        case 40: // down arrow to move Tet down
          if (that.canTetMove() === true && that.currentTet) {
            var skip = false
            if (that.newTet) skip = true
            if (!skip) clearInterval(that.loop)
            that.currentTet.moveDown()
            that.draw()
            if (!skip && !that.paused) that.tetDownLoop()
          }
          break
        case 80: case 83: // p for pause, s for stop (they do same thing)
          if (that.gameOver === false) {
            if (!that.paused) {
              clearInterval(that.loop)
              that.paused = true
              that.draw()
            } else {
              if (that.gameOver === false) {
                that.tetDownLoop()
                that.dropOnce = false
              }
              that.paused = false
              that.draw()
            }
          }
          break
        case 82: // r for reset
          that.allTets = []
          clearInterval(that.loop)
          that.currentTet = null
          that.gameOver = false
          that.newTet = true
          that.nextTet = null
          that.paused = true
          that.score = 0
          that.updateScore = true
          that.createTet()
          break
        // Developer's Controls
        case 35: // end key to move Tet up
          if (that.devModeOn && that.currentTet) {
            if (that.currentTet.topLeft.row > 0) {
              that.currentTet.topLeft.row--
            }
            that.draw()
          }
          break
        case 48: case 49: case 50: case 51: case 52: // test cases found in TestCase.js
        case 53: case 54: case 55: case 56: case 57: // number keys 0 to 9 (not numpad)
          if (that.devModeOn) {
            that.allTets = []
            that.gameOver = false
            that.score = 0
            that.updateScore = true
            that.testCase(e.keyCode - 48)
            that.createTet()
            that.tetDownLoop()
          }
          break
        case 71: // g for game over
          if (that.devModeOn) {
            that.gameOver = true
            clearInterval(that.loop)
            // that.score = 1939999955999999 // near max
            that.score = Math.random() * 100000
            that.updateScore = true
            that.draw()
          }
          break
        case 72: // h to reset high score to zero
          if (that.devModeOn) {
            that.setHighScores([0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
            that.displayHighScores()
            that.draw()
          }
          break
        case 192: // tilde key to toggle dev mode
          that.devModeOn = that.devModeOn
          that.draw()
          break
        default:
          console.log('unrecognized key: ' + e.keyCode)
      }
    }
  }

  /**
   * This method is exclusively used in the handleEvents method. We call it
   * every time we want to check if our Tet can be moved with the space bar and
   * up/right/left/down arrow keys.
   * @returns If the Tet can move, based on the conditions within the function,
   *     then return true.
   */
  canTetMove() {
    return ((this.newTet === false && this.paused === false) ||
        this.devModeOn === true) && this.gameOver === false
  }

  /**
   * This method is used to get a floating point number and separate it with
   * commas. We also round the number to the nearest integer.
   * @param number A non-comma separated number.
   * @returns A comma separated number.
   */
  commaSeparateNumber(number: number) {
    var tmp: any = Math.floor(number)
    if (tmp <= 99999999999999) {
      // from http://stackoverflow.com/a/12947816
      while (/(\d+)(\d{3})/.test(tmp.toString())) {
        tmp = tmp.toString().replace(/(\d+)(\d{3})/, '$1' + ',' + '$2')
      }
    } else if (tmp > 999999999999999) {
      tmp = tmp.toExponential(10)
    }

    return tmp
  }

  /**
   * This method updates the high score list that is displayed on the web page.
   */
  displayHighScores() {
    var highScores = this.getHighScores()
    var html = ''
    for (var i = 0, len = highScores.length; i < len; i++) {
      html += '<li>' + this.commaSeparateNumber(highScores[i]) + '</li>'
    }
    // TODO: Figure out of this is the best implementation of this
    var elem: any = document.getElementById(this.highScoresListId) || false
    if (elem) elem.innerHTML = html
  }

  /** This method draws everything to the canvas. */
  draw() {
    // Keys respectively reflect the HTML color code of Tets: I, J, L, O, S, T, Z
    var tetColor = ['#3cc', '#0af', '#f90', '#ee0', '#0c0', '#c0c', '#c00']
  
    var c = this.canvas.getContext('2d')

    // TODO: Figure out a more graceful way of doing this
    if (!c || !this.nextTet) return

    c.clearRect(0, 0, this.canvas.width, 2 * this.canvas.width) // clear canvas
  
    // Draw top panel
    // paused
    if (this.paused) {
      c.fillStyle = '#f00'
      c.font = '16px Arial'
      c.fillText('PAUSED', 5, 74)
    }
    // score
    c.fillStyle = '#000'
    c.font = '16px Arial'
    // 16 numbers max, or 14 with commas. If beyond, switch to scientific
    // notation:
    c.fillText('Score: ' + this.commaSeparateNumber(this.score), 4, 17)
    // next Tet
    c.font = '16px Arial'
    c.fillText('Next:', 35, 50)
    c.beginPath()
    c.moveTo(
        (this.nextTet.topLeft.col + this.nextTet.perimeter[0][0]) * this.blockS,
        (this.nextTet.topLeft.row + this.nextTet.perimeter[0][1]) * this.blockS + 37)
    for (var row = 1, len = this.nextTet.perimeter.length; row < len; row++) {
      c.lineTo(
          (this.nextTet.topLeft.col + this.nextTet.perimeter[row][0]) * this.blockS,
          (this.nextTet.topLeft.row + this.nextTet.perimeter[row][1]) * this.blockS + 37)
    }
    c.closePath()
    c.lineWidth = 2
    c.fillStyle = tetColor[this.nextTet.type]
    c.fill()
    c.strokeStyle = '#000'
    c.stroke()
    // separator line
    c.beginPath()
    c.moveTo(0, this.panelHeight)
    c.lineTo(this.canvasWidth, this.panelHeight)
    c.lineWidth = 2
    c.strokeStyle = '#eee'
    c.stroke()
    c.beginPath()
    c.moveTo(0, this.panelHeight)
    c.lineTo(4 * this.blockS - 3, this.panelHeight)
    c.lineTo(4 * this.blockS - 3, 2 * this.blockS - 6)
    c.lineTo(2 * 4 * this.blockS + 3, 2 * this.blockS - 6)
    c.lineTo(2 * 4 * this.blockS + 3, this.panelHeight)
    c.lineTo(this.canvasWidth, this.panelHeight)
    c.lineWidth = 2
    c.strokeStyle = '#000'
    c.stroke()
    // dev mode
    if (this.devModeOn) {
      c.fillStyle = '#0a0'
      c.font = '15px Arial'
      c.fillText('DEV', 166, 74)
    }
  
    // Draw living Tet "shadow" at bottom and rotation
    if (!this.newTet) {
      // TODO: Figure out a more graceful way of doing this
      if (!this.currentTet) {
        return
      }

      var tmpPotTopLeft = {
        row: this.currentTet.topLeft.row + 1,
        col: this.currentTet.topLeft.col
      }
      while (!this.currentTet.doesTetCollideBot(tmpPotTopLeft)) {
        tmpPotTopLeft.row++
      }
      tmpPotTopLeft.row--
      c.beginPath()
      c.moveTo(
          (tmpPotTopLeft.col + this.currentTet.perimeter[0][0]) * this.blockS,
          (tmpPotTopLeft.row + this.currentTet.perimeter[0][1]) * this.blockS + this.panelHeight)
      for (row = 1, len = this.currentTet.perimeter.length; row < len; row++) {
        c.lineTo(
            (tmpPotTopLeft.col + this.currentTet.perimeter[row][0]) * this.blockS,
            (tmpPotTopLeft.row + this.currentTet.perimeter[row][1]) * this.blockS + this.panelHeight)
      }
      c.closePath()
      c.lineWidth = 2
      c.fillStyle = '#eee'
      c.fill()
      c.strokeStyle = '#ddd'
      c.stroke()
  
      // draw pivot shadow
      if (this.currentTet.pivot > 0) {
        var potPerimeter = this.currentTet.doesNotTetPivotCollide()
        if (potPerimeter !== false) {
          c.beginPath()
          c.moveTo(
              (this.currentTet.topLeft.col + potPerimeter[0][0] + this.currentTet.pivot) * this.blockS,
              (this.currentTet.topLeft.row + potPerimeter[0][1]) * this.blockS + this.panelHeight)
          for (row = 1, len = this.currentTet.perimeter.length; row < len; row++) {
            c.lineTo(
                (this.currentTet.topLeft.col + potPerimeter[row][0] + this.currentTet.pivot) * this.blockS,
                (this.currentTet.topLeft.row + potPerimeter[row][1]) * this.blockS + this.panelHeight)
          }
          c.closePath()
          c.lineWidth = 2
          c.globalAlpha = 0.5
          c.fillStyle = '#eee'
          c.fill()
          c.strokeStyle = '#ddd'
          c.stroke()
          c.globalAlpha = 1
        }
      }
    }
  
    // Draw all Tets
    for (var tet = 0, aTLen = this.allTets.length; tet < aTLen; tet++) {
      var currTet = this.allTets[tet]
      c.beginPath()
      c.moveTo(
          (currTet.topLeft.col + currTet.perimeter[0][0]) * this.blockS,
          (currTet.topLeft.row + currTet.perimeter[0][1]) * this.blockS + this.panelHeight)
      for (row = 1, len = currTet.perimeter.length; row < len; row++) {
        c.lineTo(
            (currTet.topLeft.col + currTet.perimeter[row][0]) * this.blockS,
            (currTet.topLeft.row + currTet.perimeter[row][1]) * this.blockS + this.panelHeight)
      }
      c.closePath()
      c.lineWidth = 2
      c.fillStyle = tetColor[currTet.type]
      c.fill()
      c.strokeStyle = '#000'
      c.stroke()
    }
  
    // Draw Game Over text if game is over
    if (this.gameOver) {
      // gray tint
      c.globalAlpha = 0.8
      c.fillStyle = '#333'
      c.fillRect(0, 0, this.canvas.width, 2 * this.canvas.width)
      c.globalAlpha = 1
      // game over text
      c.fillStyle = '#f00'
      c.font = 'bold 32px Arial'
      c.fillText('GAME OVER', 3, 180)
      c.strokeStyle = '#000'
      c.lineWidth = 1
      c.strokeText('GAME OVER', 3, 180)
      // your score
      c.fillStyle = '#fff'
      c.font = 'bold 18px Arial'
      c.fillText('Your Score:', 5, 220)
      c.fillStyle = '#f00'
      c.font = 'bold 19px Arial'
      c.fillText(this.commaSeparateNumber(this.score), 14, 240)
      c.globalAlpha = 0.5
      c.strokeStyle = '#000'
      c.lineWidth = 1
      c.font = 'bold 18px Arial'
      c.strokeText('Your Score:', 5, 220)
      c.font = 'bold 19px Arial'
      c.strokeText(this.commaSeparateNumber(this.score), 14, 240)
      c.globalAlpha = 1
      // personal highest score
      var highscores = this.checkHighScore()
      c.fillStyle = '#fff'
      c.font = 'bold 17px Arial'
      c.fillText('Personal Highest Score:', 5, 270)
      c.fillStyle = '#f00'
      c.font = 'bold 19px Arial'
      c.fillText(this.commaSeparateNumber(highscores[0]), 14, 290)
      c.globalAlpha = 0.3
      c.strokeStyle = '#000'
      c.lineWidth = 1
      c.font = 'bold 17px Arial'
      c.strokeText('Personal Highest Score:', 5, 270)
      c.font = 'bold 19px Arial'
      c.strokeText(this.commaSeparateNumber(highscores[0]), 14, 290)
      c.globalAlpha = 1
      this.displayHighScores()
    }
  }

  /**
   * This method creates Tets. This also causes the Game Over screen to appear
   * when we cannot create a new Tet.
   */
  createTet() {
    // Make sure first Tet is not an S or Z
    if (this.nextTet === null) {
      // TODO: Figure out why I was using parseInt() here
      // var t: number = parseInt(Math.floor(Math.random() * 7))
      var t: number = Math.floor(Math.random() * 7)
      // TODO: Instead of doing this, keep randomly generating a number until
      // it's not a 4 or 6. This way there isn't a higher likelihood of starting
      // off with a 3 or 5 (should be as fairly random as possible) - plus there
      // isn't a performance issue to worry about since this gets generated
      // before the game even starts.
      if (t === 4 || t === 6) {
        t--
      }
      this.nextTet = new Tet(this, t)
    }

    // Build first Tet and next Tet
    if (this.newTet) {
      this.currentTet = this.nextTet
      this.nextTet = new Tet(this)
    }
    this.newTet = false

    // TODO: Figure out how to make this check unnecessary since ideally this
    // would never be null.
    if (!this.currentTet) {
      this.currentTet = this.nextTet
    }

    // Display Game Over
    if (this.currentTet.doesTetCollideBot(this.currentTet.topLeft)) {
      this.nextTet = this.currentTet
      this.gameOver = true
      this.newTet = true
      clearInterval(this.loop)
      return
    } else {
      this.allTets.push(this.currentTet)
    }

    this.draw()
  }

  /**
   * This method creates a setInterval loop which moves our currentTet down at
   * each interval.
   */
  tetDownLoop() {
    // safe guard to prevent multiple loops from spawning before clearing it out
    // first
    clearInterval(this.loop)

    var that = this
    this.loop = setInterval(function () {
      if (that.dropOnce && that.newTet) clearInterval(that.loop)
      if (that.newTet) that.createTet()
      else if (!that.paused && that.currentTet) that.currentTet.moveDown()
      that.draw()
    }, that.dropInterval)
  }

  /**
   * This method generates a landed array from allTets to be used to check for
   * Tet/fragment collisions.
   * @param tet This parameter basically excludes the given Tet from allTets
   *     which are used to generate the landed array.
   */
  getLanded(tet?: Tet) {
    if (tet !== undefined) this.updateLanded = true
    if (this.updateLanded) {
      for (var i = 0; i < Game.BOARD_ROW_NUM; i++) {
        this.landed[i] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
      }
      i = 0
      for (var aT = this.allTets, len = aT.length; i < len; i++) {
        if (aT[i] === this.currentTet || aT[i] === tet) continue
        for (var row = 0, rLen = aT[i].shape.length; row < rLen; row++) {
          for (var col = 0, cLen = aT[i].shape[row].length; col < cLen; col++) {
            if (aT[i].shape[row][col] !== 0) {
              this.landed[row + aT[i].topLeft.row][col + aT[i].topLeft.col] = 1
            }
          }
        }
      }
      this.updateLanded = false
    }

    return <number[][]> this.landed
  }

  /**
   * This method inserts all zeros into the rows of the shape array if they are
   * going to be removed. Once we do this, we call the updateLanded method.
   * @param fullRows This is the list of all rows that are to be removed from
   *     the Tet shapes.
   */
  alterShapes(fullRows: number[]) {
    var firstRow = fullRows[0]
    var lastRow = fullRows[fullRows.length - 1]
    for (var tet = 0, len = this.allTets.length; tet < len; tet++) {
      if (this.allTets[tet].topLeft.row <= firstRow - 4 ||
          this.allTets[tet].topLeft.row > lastRow) {
        continue
      }
      this.allTets[tet].alterShape(fullRows)
    }
    // this.tetsToRemove.sort(function(a,b){ return a - b }) // ensures indices are in numeric order
    for (var i = 0, len2 = this.tetsToRemove.length; i < len2; i++) {
      this.allTets.splice(this.tetsToRemove[i] - i, 1)
    }
    this.tetsToRemove = []
    this.updateLanded = true
  }

  /**
   * This method came from:
   * {@link http://www.w3schools.com/js/js_cookies.asp|W3Schools}. It allows us
   * to use cookies to retrieve the user's info.
   * @param cName This is the name of the cookie we want.
   * @returns This is the string extracted from our cookie.
   */
  getCookie(cName: string) {
    var cValue: string | null = document.cookie
    var cStart = cValue.indexOf(' ' + cName + '=')
    if (cStart === -1) cStart = cValue.indexOf(cName + '=')
    if (cStart === -1) cValue = null
    else {
      cStart = cValue.indexOf('=', cStart) + 1
      var cEnd = cValue.indexOf(';', cStart)
      if (cEnd === -1) cEnd = cValue.length
      cValue = unescape(cValue.substring(cStart, cEnd))
    }

    return cValue
  }

  /**
   * This method came from:
   * {@link http://www.w3schools.com/js/js_cookies.asp|W3Schools}. It allows us
   * to use cookies to store the user's info.
   * @param cName This is the name of the cookie we want.
   * @param value This is the value of the cookie we want to set.
   * @param exDays This is the expiration date of the cookie.
   */
  setCookie(cName: string, value: string, exDays: number) {
    var exdate = new Date()
    exdate.setDate(exdate.getDate() + exDays)
    var cValue = escape(value) +
        ((exDays === null) ? '' : '; expires=' + exdate.toUTCString())
    document.cookie = cName + '=' + cValue
  }

  /**
   * This method gets the user's high scores from their cookie.
   * @returns This is the list of the high scores of the user.
   */
  getHighScores() {
    var tmp: any = this.getCookie('highScores')
    if (tmp === null) {
      tmp = [this.score, 0, 0, 0, 0, 0, 0, 0, 0, 0]
      this.setHighScores(tmp)
    } else {
      tmp = JSON.parse(tmp)
    }
    return tmp
  }

  /**
   * This method saves the user's high scores into the cookie.
   * @param v This is the list of the high scores we're going to save in the
   *     cookie.
   */
  setHighScores(v: number[]) {
    this.setCookie('highScores', JSON.stringify(v), 365)
  }

  /**
   * This method basically adjusts the user's high scores if they made a higher
   * score than before.
   * @returns This is the list of the high scores of the user.
   */
  checkHighScore() {
    var highScores = this.getHighScores()
    if (this.updateScore === true) {
      var hsLen = highScores.length
      for (var i = 0; i < hsLen; i++) {
        if (this.score > highScores[i]) {
          highScores.splice(i, 0, this.score)
          break
        }
      }
      if (highScores.length > hsLen) highScores.pop()
      this.setHighScores(highScores)
      this.updateScore = false
    }

    return highScores
  }

  // TODO: This is from TestCase.js
  testCase(n: number) {
    console.warn('Test cases not enabled yet.')
  }
}

/**
 * This function creates a Tet class intended to be instantiated by "new Tet()".
 * However, upon completing a row in our Tetris game, we will want to remove the
 * blocks in that row.
 * 
 * In the case that our Tet becomes divided during the row removal, we will want
 * to split the whole Tet into multiple Tet fragments which is when we will use
 * "new Tet(-1)", then set its properties manually.
 * @class Represents a Tet, both living and landed.
 */
class Tet {
  /** Game object which the Tet is in */
  private game: Game
  /**
   * Initially only used to determined its shape upon our class being
   * constructed. If in range [0..6] (number of Tets), set its properties
   * appropriately. If -1, we will create a Tet with empty properties because
   * we're going to set its topLeft, shape and perimeter manually.
   */
  type: number
  /**
   * Rotation is constrained by the range [0..3]. Incrementing the rotation
   * basically rotates the shape clockwise. This rotation decides our this.shape
   * and this.perimeter.
   */
  rotation: number
  /**
   * This is the number of rows we are going to move our tet when we decide to
   * rotate it. Constraints are from [0..this.pivotMax].
   */
  pivot: number
  /** This is the maximum amount of times a block can be pivoted. */
  pivotMax: number
  /**
   * This is the (row, column) position the Tet is in with respect to the game
   * board (16 rows by 10 columns); (0, 0) being the most top left position.
   * 
   * topLeft.row - Row position of Tet on board.
   * 
   * topLeft.col - Column position of Tet on board.
   */
  topLeft: {row: number, col: number}
  /**
   * Shape of Tet, e.g. _shape = [[1,1,1,1]] is horizontal I Tetrimino where
   * [[1],[1],[1],[1]] is vertical I Tet. Number of 0 indicates empty space.
   */
  shape: number[][]
  /**
   * Perimeter of Tet, e.g. _perimeter = [[0,0],[0,1],[4,1],[4,0]] is horizontal
   * I Tet perimeter where [[0,0],[0,4],[1,4],[1,0]] is vertical I Tet. Imagine
   * Tetriminos being expressed as 4 "blocks," each block's side would be _s
   * pixels in magnitude, where _s is the variable blockS defined in index.php.
   * Therefore, we can determine its perimeter by taking the "(x, y) coordinates"
   * in each "row" of _perimeter, and multiplying each x and y value by _s.
   */
  perimeter: number[][]

  /**
   * @param game Game object which the Tet will be in
   * @param [type] Shape of Tet desired, determined randomly if undefined.
   */
  constructor(game: Game, type?: number) {
    // force instantiation
    if (!(this instanceof Tet)) {
      return new Tet(game, type)
    }

    // FIXME: does not do any checking
    this.game = game

    this.type = (type && type >= -1 && type < 7)
      ? type
      // : parseInt(Math.floor(Math.random() * 7))
      : Math.floor(Math.random() * 7)

    // TODO: if type is -1, then it is a single square or fragmented?
    if (this.type > -1) {
      this.rotation = 0
      this.pivot = 0
      this.topLeft = {row: 0, col: 4}
      this.setShape(this.getShapeMatrix(0))
    }
  }

  /**
   * This method takes in a Tet type and rotation then outputs its shape matrix.
   * This method is only needed on a live Tet. I.e. if a Tet is already placed
   * on the landed array, this method will not be used.
   * @param rotation Rotation of shape, determined by user input.
   * @returns Number matrix of shape.  If type is unexpected, return empty
   *     array.
   */
  getShapeMatrix(rotation: number) {
    // Shapes are from: http://en.wikipedia.org/wiki/Tetris#Colors_of_Tetriminos
    // The numbers in these arrays denote their eventual color.
    // NOTE: Trailing zeros were removed and replaced by spaces in the following
    // matrices as a gaming optimization (preventing unnecessary loop
    // iterations).
    /* eslint-disable comma-spacing, no-multi-spaces, standard/array-bracket-even-spacing */
    var matrixMatrix = [
      [ [[1,1,1,1]],       [[1],[1],[1],[1]] ], // I
      [ [[1,1,1],[0,0,1]], [[0,1],[0,1],[1,1]], [[1    ],[1,1,1]], [[1,1],[1  ],[1  ]] ], // J
      [ [[1,1,1],[1    ]], [[1,1],[0,1],[0,1]], [[0,0,1],[1,1,1]], [[1  ],[1  ],[1,1]] ], // L
      [ [[1,1],  [1,1]] ], // O
      [ [[0,1,1],[1,1  ]], [[1  ],[1,1],[0,1]] ], // S
      [ [[1,1,1],[0,1  ]], [[0,1],[1,1],[0,1]], [[0,1  ],[1,1,1]], [[1  ],[1,1],[1  ]] ], // T
      [ [[1,1  ],[0,1,1]], [[0,1],[1,1],[1  ]] ] // Z
    ]
    /* eslint-enable comma-spacing, no-multi-spaces, standard/array-bracket-even-spacing */
    var m = matrixMatrix[this.type]
    switch (this.type) {
      case 0: // I needs 3 pivots
        this.pivotMax = 3
        break
      case 3: // O needs no pivots
        this.pivotMax = 0
        break
      default: // every other Tet needs 1
        this.pivotMax = 1
    }
    var out: number[][]
    switch (m.length) {
      case 1:
        return m[0]
      case 2:
        return m[rotation % 2]
      case 4:
        return m[rotation]
      default:
        // console.log('unexpected array length in function ' +
        //     arguments.callee.toString().substr(
        //         9, arguments.callee.toString().indexOf('(') - 9))
        return []
    }
  }

  /**
   * This method is used any time a living/landed Tet's shape is
   * created/altered. Upon breaking up a tet, make sure these conditions are met
   * on its new shape:
   * 
   * 1) Remove trailing zeros from each row, e.g. [1,0] becomes [1];
   * 
   * 2) If new shape is one row, remove leading zeros, e.g. [0,1] becomes [1].
   *    Which they are in the Tet.cleanShape() method.
   * 
   * @param shape This is the shape of the Tet we care about getting the
   *     perimeter from.
   * @returns Perimeter of shape. If shape is unknown, return empty array.
   */
  getPerimeter(shape: number[][]) {
    // NOTE: Trailing zeros were removed and replaced by spaces in the following
    // matrices as a gaming optimization (preventing unnecessary loop
    // iterations).
    /* eslint-disable comma-spacing, no-multi-spaces, standard/array-bracket-even-spacing */
    var periMatrix = [
      [ [[1]],               [[0,0],[0,1],[1,1],[1,0]] ], // fragments
      [ [[1,1]],             [[0,0],[0,1],[2,1],[2,0]] ],
      [ [[1],[1]],           [[0,0],[0,2],[1,2],[1,0]] ],
      [ [[1,1,1]],           [[0,0],[0,1],[3,1],[3,0]] ],
      [ [[1],[1],[1]],       [[0,0],[0,3],[1,3],[1,0]] ],
      [ [[1,1],[0,1]],       [[0,0],[0,1],[1,1],[1,2],[2,2],[2,0]] ],
      [ [[0,1],[1,1]],       [[1,0],[1,1],[0,1],[0,2],[2,2],[2,0]] ],
      [ [[1  ],[1,1]],       [[0,0],[0,2],[2,2],[2,1],[1,1],[1,0]] ],
      [ [[1,1],[1  ]],       [[0,0],[0,2],[1,2],[1,1],[2,1],[2,0]] ],
      [ [[1,1,1,1]],         [[0,0],[0,1],[4,1],[4,0]] ], // I
      [ [[1],[1],[1],[1]],   [[0,0],[0,4],[1,4],[1,0]] ],
      [ [[1,1,1],[0,0,1]],   [[0,0],[0,1],[2,1],[2,2],[3,2],[3,0]] ], // J
      [ [[0,1],[0,1],[1,1]], [[1,0],[1,2],[0,2],[0,3],[2,3],[2,0]] ],
      [ [[1    ],[1,1,1]],   [[0,0],[0,2],[3,2],[3,1],[1,1],[1,0]] ],
      [ [[1,1],[1  ],[1  ]], [[0,0],[0,3],[1,3],[1,1],[2,1],[2,0]] ],
      [ [[1,1,1],[1    ]],   [[0,0],[0,2],[1,2],[1,1],[3,1],[3,0]] ], // L
      [ [[1,1],[0,1],[0,1]], [[0,0],[0,1],[1,1],[1,3],[2,3],[2,0]] ],
      [ [[0,0,1],[1,1,1]],   [[2,0],[2,1],[0,1],[0,2],[3,2],[3,0]] ],
      [ [[1  ],[1  ],[1,1]], [[0,0],[0,3],[2,3],[2,2],[1,2],[1,0]] ],
      [ [[1,1],[1,1]],       [[0,0],[0,2],[2,2],[2,0]] ], // O
      [ [[0,1,1],[1,1  ]],   [[1,0],[1,1],[0,1],[0,2],[2,2],[2,1],[3,1],[3,0]] ], // S
      [ [[1  ],[1,1],[0,1]], [[0,0],[0,2],[1,2],[1,3],[2,3],[2,1],[1,1],[1,0]] ],
      [ [[1,1,1],[0,1  ]],   [[0,0],[0,1],[1,1],[1,2],[2,2],[2,1],[3,1],[3,0]] ], // T
      [ [[0,1],[1,1],[0,1]], [[1,0],[1,1],[0,1],[0,2],[1,2],[1,3],[2,3],[2,0]] ],
      [ [[0,1  ],[1,1,1]],   [[1,0],[1,1],[0,1],[0,2],[3,2],[3,1],[2,1],[2,0]] ],
      [ [[1  ],[1,1],[1  ]], [[0,0],[0,3],[1,3],[1,2],[2,2],[2,1],[1,1],[1,0]] ],
      [ [[1,1  ],[0,1,1]],   [[0,0],[0,1],[1,1],[1,2],[3,2],[3,1],[2,1],[2,0]] ], // Z
      [ [[0,1],[1,1],[1  ]], [[1,0],[1,1],[0,1],[0,3],[1,3],[1,2],[2,2],[2,0]] ]
    ]
    /* eslint-enable comma-spacing, no-multi-spaces, standard/array-bracket-even-spacing */
    var checkNextShape
    // Iterate through periMatrix to see if the given shape matches a shape
    // within this array
    for (var pRow = 0, pLen = periMatrix.length; pRow < pLen; pRow++) {
      checkNextShape = false
      for (var row = 0, rLen = shape.length; row < rLen; row++) {
        if (rLen !== periMatrix[pRow][0].length) {
          checkNextShape = true
          break
        }
        if (checkNextShape) break
        for (var col = 0, cLen = shape[row].length; col < cLen; col++) {
          if (shape[row].length !== periMatrix[pRow][0][row].length) {
            checkNextShape = true
            break
          }
          if (shape[row][col] === periMatrix[pRow][0][row][col]) {
            continue
          }
          checkNextShape = true
          break
        }
      }
      if (!checkNextShape) {
        // if it gets to this point, we found our point array
        return periMatrix[pRow][1]
      }
    }
    return []
  }

  /**
   * This method actually sets the shape and perimeter of the Tet that's
   * executing this method.
   * @param shape This is the shape of the Tet we care about getting the
   *     perimeter from.
   */
  setShape(shape: number[][]) {
    this.shape = shape
    this.perimeter = this.getPerimeter(shape)
  }

  /**
   * This method changes the rotation, if the shape can rotate properly on the
   * game board, and changes the shape and perimeter if it successfully rotates.
   * Otherwise, do nothing. We also move the Tet this.pivot blocks to the right,
   * then reset the pivot to zero.
   * 
   * By default, always rotates clockwise.
   * 
   * @param shape This is the shape of the Tet we care about getting the
   *     perimeter from.
   * @returns Currently, we don't care about the actual return value.
   */
  rotate() {
    var landed = this.game.getLanded()
    var potRot = this.rotation
    var potShape
    potRot = (potRot < 3 ? potRot + 1 : 0)
    potShape = this.getShapeMatrix(potRot)
    // check for potential collisions
    for (var row = 0, rLen = potShape.length; row < rLen; row++) {
      for (var col = 0, cLen = potShape[row].length; col < cLen; col++) {
        if (potShape[row][col] !== 0) {
          if (col + this.topLeft.col < 0) {
            // console.log('left beyond playing field')
            return false
          }
          if (col + this.topLeft.col >= Game.BOARD_COL_NUM) {
            // console.log('right beyond playing field')
            return false
          }
          if (row + this.topLeft.row >= Game.BOARD_ROW_NUM) {
            // console.log('below playing field')
            return false
          }
          if (landed[row + this.topLeft.row][col + this.topLeft.col] !== 0) {
            // console.log('rotate: space is taken')
            return false
          }
        }
      }
    }
    this.topLeft.col += this.pivot
    this.pivot = 0
    this.rotation = potRot
    this.setShape(potShape)
    return true
  }

  /**
   * This method checks to see if the pivot shape shadow can display properly.
   * @returns This returns the perimeter matrix given by the getPerimeter()
   *     method.
   */
  doesNotTetPivotCollide() {
    var potRot = this.rotation
    var potentialTopLeft = {
      row: this.topLeft.row,
      col: this.topLeft.col + this.pivot
    }
    var potShape
    var landed = this.game.getLanded(this)
    potRot = potRot < 3 ? potRot + 1 : 0
    potShape = this.getShapeMatrix(potRot)
    for (var row = 0, rLen = potShape.length; row < rLen; row++) {
      for (var col = 0, cLen = potShape[row].length; col < cLen; col++) {
        if (potShape[row][col] !== 0) {
          if (row + potentialTopLeft.row >= Game.BOARD_ROW_NUM) {
            // console.log('below playing field')
            return false
          }
          if (landed[row + potentialTopLeft.row][col + potentialTopLeft.col] !== 0) {
            // console.log('bot: space taken')
            return false
          }
          if (col + potentialTopLeft.col < 0) {
            // console.log('left beyond playing field')
            return false
          }
          if (col + potentialTopLeft.col >= Game.BOARD_COL_NUM) {
            // console.log('right beyond playing field')
            return false
          }
          if (landed[row + potentialTopLeft.row][col + potentialTopLeft.col] !== 0) {
            // console.log('side: space taken')
            return false
          }
        }
      }
    }
    return this.getPerimeter(potShape)
  }

  /**
   * This method checks to see if a Tet will collide with the bottom of the game
   * board or another Tet.
   * @param potentialTopLeft This object contains a potential row and column
   *     which we use to check to see if the Tet will collide if it moves to the
   *     coordinate specified by this param.
   * @returns If Tet colides, return true; else, false.
   */
  doesTetCollideBot(potentialTopLeft: {row: number, col: number}) {
    var landed = this.game.getLanded(this)
    for (var row = 0, rLen = this.shape.length; row < rLen; row++) {
      for (var col = 0, cLen = this.shape[row].length; col < cLen; col++) {
        if (this.shape[row][col] !== 0) {
          if (row + potentialTopLeft.row >= Game.BOARD_ROW_NUM) {
            // console.log('below playing field')
            return true
          }
          if (landed[row + potentialTopLeft.row][col + potentialTopLeft.col] !== 0) {
            // console.log('bot: space taken')
            return true
          }
        }
      }
    }
    return false
  }

  /**
   * This method checks to see if a Tet will collide with the side of the game
   * board or another Tet. If it collides on the right side of the Tet, we'll
   * adjust the pivot as necessary.
   * @param potentialTopLeft This object contains a potential row and column
   *     which we use to check to see if the Tet will collide if it moves to the
   *     coordinate specified by this param.
   * @param [direction] If value is 1, we are testing the right side
   *     and we're going to adjust the pivot.
   * @returns If Tet colides, return true; else, false.
   */
  doesTetCollideSide(
        potentialTopLeft: {row: number, col: number},
        direction?: number) {
    var landed = this.game.getLanded()
    for (var row = 0, rLen = this.shape.length; row < rLen; row++) {
      for (var col = 0, cLen = this.shape[row].length; col < cLen; col++) {
        if (this.shape[row][col] !== 0) {
          if (col + potentialTopLeft.col < 0) {
            // console.log('left beyond playing field');
            return true
          }
          if (col + potentialTopLeft.col >= Game.BOARD_COL_NUM) {
            // console.log('right beyond playing field');
            if (this.pivot < this.pivotMax && this.rotation % 2 === 0) {
              this.pivot++
            }
            return true
          }
          if (landed[row + potentialTopLeft.row][col + potentialTopLeft.col] !== 0) {
            // console.log('side: space taken');
            if (direction === 1 &&
                (this.pivot < this.pivotMax && this.rotation % 2 === 0)) {
              this.pivot++
            }
            return true
          }
        }
      }
    }
    return false
  }

  /**
   * This method moves the Tet left by 1 column if it does not collide with the
   * side of the game board or another Tet. This method also resets the pivot to
   * zero.
   */
  moveLeft() {
    this.pivot = 0
    var potentialTopLeft = {
      row: this.topLeft.row,
      col: this.topLeft.col - 1
    }
    if (!this.doesTetCollideSide(potentialTopLeft)) {
      this.topLeft = potentialTopLeft
    }
  }

  /**
   * This method moves the Tet right by 1 column if it does not collide with the
   * side of the game board or another Tet.
   */
  moveRight() {
    var potentialTopLeft = {
      row: this.topLeft.row,
      col: this.topLeft.col + 1
    }
    if (!this.doesTetCollideSide(potentialTopLeft, 1)) {
      this.topLeft = potentialTopLeft
    }
  }

  /**
   * This method moves the Tet down by 1 column if it does not collide with the
   * side of the game board or another Tet. If it does collide, the Tet lands,
   * we create another Tet, and we perform the collided method to handle row
   * elimination and Tet fragmentation.
   */
  moveDown() {
    var potentialTopLeft = {
      row: this.topLeft.row + 1,
      col: this.topLeft.col
    }
    if (!this.doesTetCollideBot(potentialTopLeft)) {
      this.topLeft = potentialTopLeft
    } else {
      this.game.newTet = true
      this.game.currentTet = null
      this.game.updateLanded = true
      this.collided()
    }
  }

  /**
   * This method handles row elimination and Tet fragmentation. We also adjust
   * the score depending on how many rows get eliminated. The score scales with
   * how many rows get eliminated at once by the following formula:
   * 
   * `score += (fRLen ** (1 + (fRLen - 1) * 0.1)) * 10000`
   * 
   * We then perform the falling animations on the Tets affected by "gravity."
   */
  collided() {
    var landed = this.game.getLanded()
    var isFilled
    var fullRows = []
    var fRLen
    // Find the rows we're going to eliminate
    for (var row = this.topLeft.row; row < Game.BOARD_ROW_NUM; row++) {
      isFilled = true
      for (var col = 0; col < Game.BOARD_COL_NUM; col++) {
        if (landed[row][col] === 0) {
          isFilled = false
        }
      }
      if (isFilled) fullRows.push(row)
    }
    this.game.updateLanded = true
    fRLen = fullRows.length
    if (fRLen === 0) return
    // Adjust score (Scale the point rewarded for filling rows to benefit those
    // that break more at one time.)
    this.game.score += (fRLen ** (1 + (fRLen - 1) * 0.1)) * 10000
    // Alter the shapes
    this.game.alterShapes(fullRows)
    this.game.updateLanded = true
    // Perform falling animations
    var that = this
    // var movingTets = [0] // TODO: why is this 0?
    var movingTets = []
    var tetsMoved
    var moveLoop = setInterval(function () {
      movingTets = []
      tetsMoved = true
      while (tetsMoved) {
        tetsMoved = false
        for (var tet = 0, aT = that.game.allTets, tLen = aT.length, potTL = null;
              tet < tLen; tet++) {
          if (movingTets.indexOf(aT[tet], 0) > -1 ||
              (aT[tet] === that.game.currentTet && that.game.newTet !== true)) {
            continue
          }
          potTL = {
            row: aT[tet].topLeft.row + 1,
            col: aT[tet].topLeft.col
          }
          if (!aT[tet].doesTetCollideBot(potTL)) {
            aT[tet].topLeft = potTL
            movingTets.push(aT[tet])
            tetsMoved = true
          }
        }
        that.game.updateLanded = true
      }
      that.game.draw()
      if (movingTets.length === 0) {
        clearInterval(moveLoop)
        that.collided()
      }
    }, 200)
  }

  /**
   * This method cleans up a Tet or Tet fragment, after being affected the by
   * collided method which affects the shape of Tets located in the rows being
   * eliminated. By cleaning, we mean removing extraneous zeros from their shape
   * matrix as well as adjusting their topLeft property. We clean them so that
   * we can match its shape against a known Tet/fragment so we can determine its
   * perimeter.
   * @param o This is a object which holds a shape and a topLeft property.
   * @returns This is the cleaned up shape, without extraneous zeros, and
   *     adjusted topLeft.
   */
  cleanShape(o: {shape: number[][], topLeft: {row: number, col: number}}) {
    var shape = o.shape
    var topLeft = o.topLeft
    var done = false
    // If there exists columns of all zeros on the far left, remove all those
    // columns
    while (true) {
      for (var row = 0, len = shape.length; row < len; row++) {
        if (shape[row][0] > 0) {
          done = true
          break
        }
      }
      if (done) break
      for (row = 0, len = shape.length; row < len; row++) {
        shape[row].splice(0, 1)
      }
      // Adjust topLeft if necessary
      topLeft.col += 1
    }
    // If there exists zeros at the end of each row array, remove those zeros
    for (row = 0, len = shape.length; row < len; row++) {
      for (var col = shape[row].length - 1; col >= 0; col--) {
        if (shape[row][col] === 0) {
          shape[row].splice(col, 1)
          continue
        }
        break
      }
    }
    return {shape: shape, topLeft: topLeft}
  }

  /**
   * This method checks to see if itself, an array, is all zeros.
   * @returns If itself is all zeros, return true; else, false.
   */
  arrayIsAllZeros(arr: number[]) {
    for (var col = 0, len = arr.length; col < len; col++) {
      if (arr[col] > 0) return false
    }
    return true
  }

  /**
   * This method parses its own shape to determine if it needs to fragment or
   * not. If it becomes fragmented, we instantiate a new Tet class to add in its
   * fragmented part.
   */
  updateTet() {
    var currShape = []
    var topLeft: {row: number, col: number} = this.topLeft
    var q = []
    // Iterate through the altered shape to build multiple fragments if necessary
    for (var row = 0, len = this.shape.length; row < len; row++) {
      // If we do not come across a row with all zeros, continue building our shape
      if (!this.arrayIsAllZeros(this.shape[row])) {
        if (currShape.length === 0) {
          topLeft = {row: this.topLeft.row + row, col: this.topLeft.col}
        }
        currShape.push(this.shape[row])
      // FIXME: Otherwise, push this current shape only the queue and reset our temporary
      // shape to potentially build another
      } else {
        if (currShape.length === 0) continue
        q.push({shape: currShape, topLeft: topLeft})
        currShape = []
      }
    }

    if (currShape.length > 0) q.push({shape: currShape, topLeft: topLeft})

    if (q.length === 0) {
      // Remove this Tet from allTets if shape is a zero'd matrix (Tet completely gone)
      this.game.tetsToRemove.push(this.game.allTets.indexOf(this))
    }

    // Iterate through our queue
    for (var qs = 0, len2 = q.length; qs < len2; qs++) {
      var tmp = this.cleanShape(q[qs])
      // For the first object in the queue, keep our current Tet and just set the shape
      if (qs === 0) {
        this.topLeft = tmp.topLeft
        this.setShape(tmp.shape)
      // For all other objects in the queue, create a new Tet class and set its
      // shape, then push this new Tet onto the allTets Game class property
      } else {
        var newTet = new Tet(this.game, -1)
        newTet.type = this.type
        newTet.topLeft = tmp.topLeft
        newTet.setShape(tmp.shape)
        this.game.allTets.push(newTet)
      }
    }
  }

  /**
   * This method sets each row within its shape to zero for each row marked as
   * full.
   * @param fullRows This is an array of all of the rows that were marked as
   *     full in the collided method above.
   */
  alterShape(fullRows: number[]) {
    for (var i = 0, len = fullRows.length, row; i < len; i++) {
      row = fullRows[i] - this.topLeft.row
      if (row < 0 || row > this.shape.length - 1) {
        continue
      }
      for (var col = 0, cLen = this.shape[row].length; col < cLen; col++) {
        this.shape[row][col] = 0
      }
    }
    this.updateTet()
  }
}
