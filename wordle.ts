// type definitions

// status for a guess: correct (green), misplaced (yellow), absent (red)
// also including the letters that were not tried
// (for the keyboard)
export type Guess = "correct"|"misplaced"|"absent"|"untried"

// a single letter, that keeps its index
export interface Letter {
  character: string;
  index: number;
}

// a word is a sequence of letters
type Word = Letter[]

// the status of a guess for a letter
export interface LetterGuess {
  letter: Letter;
  kind: Guess; 
}

// a temporary structure to accumulate data
// it contains:
// the letters for which we know the status
// the remaining letters in the guess
// the remaining letters in the answer
interface GuessData {
  result: LetterGuess[];
  guessLeft: Letter[];
  wordLeft: Letter[];
}

// a function to convert a string into a word
export const stringToWord = (str: string): Word => {
  const [...charList] = str 
  return charList.map((c, idx) => ({character: c, index: idx}))
}

// the function that finds the "green" letters in the guess
// and "removes" them from the set of letters to consider further
const corrects = (guess: Word, answer: Word): GuessData => {
  if (guess.length === 0) return {result: [], guessLeft: [], wordLeft: []}
  const [currGuess, ...guesses] = guess
  const [currAnswer, ...answers] = answer
  const {result, guessLeft, wordLeft} = corrects(guesses, answers)
  if (currGuess.character === currAnswer.character) {
    const correct: LetterGuess = {letter: currGuess, kind: "correct"}
    return {result: [correct, ...result], guessLeft, wordLeft}
  }
  return {result, guessLeft: [currGuess, ...guessLeft], wordLeft: [currAnswer, ...wordLeft]}
}


// two functions to find the "yellow" letters

// a function that goes through a list, and determines whether it contains a given letter
// if the letter is present, it is "removed" from the list
// if the letter is absent, the list is unchanged
const hasLetter = (letter: Letter, [first, ...rest]: Letter[]): [boolean, Letter[]] => {
  if (first === undefined) return [false, []]
  if (letter.character === first.character) return [true, rest]
  const [bool, letters] = hasLetter(letter, rest)
  return [bool, [first, ...letters]]
}

// we use this previous function once for each letter of the guess
// this function works a bit like "corrects", but it only goes through one list at a time
// because it uses the "hasLetter" function to go through the second list
const misplaced = (guess: Word, answer: Word): GuessData => {
  if (guess.length === 0) return {result: [], guessLeft: [], wordLeft: answer}
  const [currGuess, ...guesses] = guess
  const [letterFound, answerLeft] = hasLetter(currGuess, answer)
  const {result, guessLeft, wordLeft} = misplaced(guesses, answerLeft)
  if (letterFound) {
    const misplacedLetter: LetterGuess = {letter: currGuess, kind: "misplaced"}
    return {result: [misplacedLetter, ...result], guessLeft, wordLeft}
  } 
  return {result, guessLeft: [currGuess, ...guessLeft], wordLeft: wordLeft}
}

// this function brings all the pieces together, and finds the green, yellow, and red letters
export const rateGuesses = (guess: string, answer: string): LetterGuess[] => {
  const {result, guessLeft, wordLeft} = corrects(stringToWord(guess), stringToWord(answer))
  const secondResult = misplaced(guessLeft, wordLeft)
  const incorrects: LetterGuess[] = secondResult.guessLeft.map(letter => ({letter, kind: "absent" }))
  const allResults = [...result, ...secondResult.result, ...incorrects].sort((a, b) => a.letter.index - b.letter.index)
  return allResults
}

// a simple test function for evalauting the guesses
// the expected result is a string of "colors"
const testGuess = (guess: string, answer: string, expected: string): void => {
  const result = rateGuesses(guess, answer).map((g: LetterGuess) => {
    switch (g.kind) {
      case "correct": return "G";
      case "misplaced": return "Y";
      case "absent": return "R"; 
    }
  }).join("")
  console.assert(result === expected, "\nguess:  %s\nanswer: %s \nexpect: %s\nresult: %s", guess, answer, expected, result)
}

testGuess("aa","aa","GG")
testGuess("aab","aaa","GGR")
testGuess("hello","wells","RGGGR")
testGuess("rotor","robot","GGYGR")
testGuess("roots","robot","GGYYR")
testGuess("robot","roots","GGRYY")
testGuess("robot","rotor","GGRGY")
testGuess("mummy","money","GRRRG")
testGuess("money","mummy","GRRRG")
testGuess("mummy","hummm","YGGGR")
testGuess("hummm","mummy","RGGGY")
testGuess("mummu","muumy","GGRGY")
testGuess("abcde","edcba","YYGYY")


// this set of function is dedicated to "coloring the keyboard"
// for the keyboard, what we want is to get the "best" status among all the guesses

// this function takes a list of guesses, for any letters, 
// and returns the ones for the letter we are interested in
const allGuessesForLetter = (letter: Letter, allGuesses: LetterGuess[]): Guess[] => 
  allGuesses.filter(g => g.letter.character === letter.character).map(g => g.kind)

// this function picks the "best guess" for this letter
const bestGuessForLetter = (letter: Letter, allGuesses: LetterGuess[]): LetterGuess => {
  const letterGuesses = allGuessesForLetter(letter, allGuesses)
  if (letterGuesses.find(g => g === "correct")) return {letter, kind: "correct"}
  if (letterGuesses.find(g => g === "misplaced")) return {letter, kind: "misplaced"}
  if (letterGuesses.find(g => g === "absent")) return {letter, kind: "absent"}
  // if we reach here, the letter has not been tried yet
  return {letter, kind: "untried"}
}

// this function takes a "list of letters" as a string, and returns the "best guess" for each of them
export const bestGuesses = (letters: string, guesses: string[], answer: string): LetterGuess[] => {
  const allGuesses = guesses.flatMap(g => rateGuesses(g, answer))
  return stringToWord(letters).map(letter => bestGuessForLetter(letter, allGuesses)) 
}

// this section is concerned with "rendering" the data in textual format
// not needed for react version

// this is a type definition for the overall state of the game
export interface Wordle {
  guesses: string[];
  answer: string;
  words: string[];
  validwords: string[];
  maxGuesses: number;
  mode: "easy"|"hard";
  statistics: number[];
}

// here we have a few helper functions that create a board to render
// that also contains "empty guesses"
const emptyGuess: string = "     "
const initializeGuesses = (n:number): string[] => n <= 0?[]:[emptyGuess, ...initializeGuesses(n - 1)]
export const fillGuesses = (guesses: string[], n: number): string[] => [...guesses, ...initializeGuesses(n - guesses.length)]

// then we can render the entire state of the game, in this function
// not needed here


// the higher-level game logic is here 

export const isValid = (guess: string, words: string[]): boolean => words.find(w => w === guess) !== undefined

// new function for the react native version
export const isValidPrefix = (prefix: string, words: string[]): boolean => words.find(w => w.startsWith(prefix)) !== undefined

// in hard mode, it is valid if it is "similar enough" to the previous guess
const isValidHard = (guess: string, previous: string, answer: string): boolean => {
  const previousChars = rateGuesses(previous, answer)
                            .filter(g => g.kind !== "absent")
                            .map(g => g.letter.character)
  return previousChars.every(character => guess.includes(character))
}

// some tests for this
console.assert(isValidHard("abcde","abcdf","abcde"))
console.assert(!isValidHard("zxvab","abcdf","abczx"))
console.assert(isValidHard("zcvab","abcdf","abczx"))

// the function that tests if a guess is valid, taking into account the game mode
export const isValidGuess = (guess: string, {mode, validwords, answer, guesses}: Wordle) => {
  if (!isValid(guess, validwords)) {
    
    return false
  }
  // additional check if we are in hard mode
  if (mode === "hard") {
    const previous = guesses.length===0?"    ":guesses[guesses.length - 1]
    return isValidHard(guess, previous, answer)
  }
  return true
}

// a basic help string
// not needed here

// a very basic statistics rendering
// "7" means that the game was lost
// an improved version would render this more clearly
const stats = (statistics: number[]): string => {
  const buckets = [1, 2, 3, 4, 5, 6, 7].map(num => statistics.filter(s => s === num))
  return buckets.map((bucket, index) => (index + 1) + ": " + bucket.length).join("\n")
}


// this section deals with multiple turns of the game
// mostly removed since not needed in RN version

// a function to determine the status of the game 
export const status = ({guesses, answer, maxGuesses}: Wordle): "win"|"lost"|"next" => {
  const last = guesses[guesses.length - 1]
  if (last === answer) return "win"
  if (guesses.length === maxGuesses) return "lost"
  return "next"
}

// a simple function to pick a word at random
export const randomWord = (answers: string[]): string => {
  const rand = Math.floor(Math.random() * answers.length)
  return answers[rand]
}

// this is a function to start a new game
export const newWordle = (game: Wordle, word: string|null): Wordle => {
  const answer = word === null? randomWord(game.words): word
  const gameStatus = status(game)
  // we make a copy of the game, erasing the guesses, adding the answer
  // adding statistics, but ONLY if the game was finished
  switch (gameStatus) {
    case "next": return {...game, guesses: [], answer: answer} // unfinished game, statistics not added
    case "lost": return {...game, guesses: [], answer: answer, statistics: [...game.statistics, -1]}
    case "win": return {...game, guesses: [], answer: answer, statistics: [...game.statistics, game.guesses.length]}
  }
}


// a function that processes the input
// not needed here 

// the main function takes care of input/output
// not needed here
