// type definitions

// status for a guess: correct (green), misplaced (yellow), absent (red)
// also including the letters that were not tried
// (for the keyboard)
export type Guess = "correct"|"misplaced"|"absent"|"untried"|"blank"

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
  answerLeft: Letter[];
}

const blankFiller = (remaining: number):LetterGuess[]=>{
  if(remaining==0){
    const BlankLetter: Letter = {
      character: " ",
      index: 0
    }
    const BlankGuess: LetterGuess = {
      letter:BlankLetter,
      kind: "blank"
    }
    return [BlankGuess]
  } else {
    let leftBlank = blankFiller(remaining-1)
    leftBlank.every(blankGuess => {
      blankGuess.letter.index++
    })
    const BlankLetter: Letter = {
      character: " ",
      index: remaining
    }
    const BlankGuess: LetterGuess = {
      letter:BlankLetter,
      kind: "blank"
    }
    return [BlankGuess,...leftBlank]

  }
}

// a function to convert a string into a word
export const stringToWord = (str: string): Word => {
  const [...charList] = str 
  return charList.map((c, idx) => ({character: c, index: idx}))
}

// the function that finds the "green" letters in the guess
// and "removes" them from the set of letters to consider further
const corrects = (guess: Word, answer: Word): GuessData => {
  if(guess.length === 0 && answer.length!=0)return {result:blankFiller(answer.length-1),guessLeft:[],answerLeft:[]}
  if (guess.length === 0) return {result: [], guessLeft: [], answerLeft: []}
  const [currGuess, ...guesses] = guess
  const [currAnswer, ...answers] = answer
  const {result, guessLeft, answerLeft} = corrects(guesses, answers)
  if (currGuess.character === currAnswer.character) {
    const correct: LetterGuess = {letter: currGuess, kind: "correct"}
    return {result: [correct, ...result], guessLeft, answerLeft: answerLeft}
  }
  return {result, guessLeft: [currGuess, ...guessLeft], answerLeft: [currAnswer, ...answerLeft]}
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
  if (guess.length === 0) return {result: [], guessLeft: [], answerLeft: answer}
  const [currGuess, ...guesses] = guess
  const [letterFound, remainingAnswer] = hasLetter(currGuess, answer)
  const {result, guessLeft, answerLeft} = misplaced(guesses, remainingAnswer)
  if (letterFound) {
    const misplacedLetter: LetterGuess = {letter: currGuess, kind: "misplaced"}
    return {result: [misplacedLetter, ...result], guessLeft, answerLeft: answerLeft}
  } 
  return {result, guessLeft: [currGuess, ...guessLeft], answerLeft: answerLeft}
}

// this function brings all the pieces together, and finds the green, yellow, and red letters
export const rateGuesses = (guess: string, answer: string): LetterGuess[] => {
  const {result, guessLeft, answerLeft} = corrects(stringToWord(guess), stringToWord(answer),)
  result.forEach(maybeBlank=>{
    if(maybeBlank.kind=="blank"){
      maybeBlank.letter.index+=answer.length
    }
  })
  const secondResult = misplaced(guessLeft, answerLeft)
  const incorrect: LetterGuess[] = secondResult.guessLeft.map(letter => ({letter, kind: "absent" }))
  return [...result, ...secondResult.result, ...incorrect].sort((a, b) => a.letter.index - b.letter.index)
}

// a simple test function for evalauting the guesses
// the expected result is a string of "colors"
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

// this is a type definition for the overall state of the game
export interface Wordle {
  guesses: string[];
  answer: string;
  words: string[];
  valid_words: string[];
  maxGuesses: number;
  mode: "easy"|"hard";
  statistics: number[];
}

// here we have a few helper functions that create a board to render
// that also contains "empty guesses"
const emptyGuess = (length:number) : string => Array(length+1).join(" ");
const initializeGuesses = (n:number,guessLength:number): string[] => n <= 0?[]:[emptyGuess(guessLength), ...initializeGuesses(n - 1,guessLength)]
export const fillGuesses = (guesses: string[], n: number,answerLength:number): string[] => [...guesses, ...initializeGuesses(n - guesses.length,answerLength)]

// the higher-level game logic is here 

export const isValid = (guess: string, words: string[]): boolean => words.find(w => w === guess) !== undefined

// new function for the React native version
export const isValidPrefix = (prefix: string, words: string[]): boolean => words.find(w => w.startsWith(prefix)) !== undefined

// in hard mode, it is valid if it is "similar enough" to the previous guess
const isValidHard = (guess: string, previous: string, answer: string): boolean => {
  const previousChars = rateGuesses(previous, answer)
                            .filter(g => g.kind !== "absent")
                            .map(g => g.letter.character)
  return previousChars.every(character => guess.includes(character))
}

// the function that tests if a guess is valid, taking into account the game mode
export const isValidGuess = (guess: string, {mode, valid_words, answer, guesses}: Wordle) => {
  if (!isValid(guess, valid_words)) {
    return false
  }
  // additional check if we are in hard mode
  if (mode === "hard") {
    const previous = guesses.length===0?"    ":guesses[guesses.length - 1]
    return isValidHard(guess, previous, answer)
  }
  return true
}

// a function to determine the status of the game 
export const status = ({guesses, answer, maxGuesses}: Wordle): "win"|"lost"|"next" => {
  const last = guesses[guesses.length - 1]
  if (last === answer) return "win"
  if (guesses.length === maxGuesses) return "lost"
  return "next"
}
