// this is a version of wordle that support multiple games (2, 3, 4, 5, ...)
// it is very similar to the wordle version with one game
// here we highlight only the differences between the two versions
// for detailed comments of the components of the single game version, refer to:
// https://snack.expo.dev/@rrobbes/wordle-solution



// sometimes typescript fails to process these two modules, but they work fine in javascript
import {allwords} from './allwords';
import {answers} from './answers';
import {Letter, LetterGuess, Wordle, rateGuesses, bestGuesses, fillGuesses, isValidGuess, isValidPrefix, randomWord, status, stringToWord} from './wordle';
import React, {useState} from 'react';
import {Text, View, StyleSheet, Pressable, Button, TextInput, ScrollView, Share} from 'react-native';
import Constants from 'expo-constants';
import { Card } from 'react-native-paper';

// one change is that we do not use files for reading the words anymore, for simplicity
// the resources are defined in TypeScript modules

type StrCallback = (arg: string) => void
type Callback = () => void
type MultiWordleCallback = (arg: Wordle[]) => void

let share: string|null = null
function appendGuess(guess: LetterGuess): string {
    let tmp = share;
    let append: string;
    switch (guess.kind) {
        case 'correct': {
            append = '🟩';
            break;
        }
        case 'misplaced': {
            append = '🟨';
            break;
        }
        default:
            append = '⬜';
    }
    return tmp + append;
}

const onShare = async () => {
    try {
        await Share.share({
            message:""+share,
        });
    } catch (error) {
        console.error(error)
    }
};

const background = (g: LetterGuess) => {
  switch (g.kind) {
    case "correct": return styles.correct
    case "absent": return styles.absent
    case "misplaced": return styles.misplaced
    default: return styles.untried
  }
}

const BoardLetter = ({guess}:{guess: LetterGuess}) => (
  <View style={[styles.boardCell, background(guess)]}><Text style={styles.keyText}>{guess.letter.character}</Text></View>
  )

const BoardRow = ({letters}:{letters: LetterGuess[]}) => (
  <View style = {styles.row}>{letters.map(l => <BoardLetter guess={l} />)}</View>
)

const Board = ({game, guess, valid}:{game: Wordle, guess: string, valid: boolean}) => {
    //The list holding all the present guesses
    const guesses = game.guesses.map((guess:string) => 
          rateGuesses(guess, game.answer))
    //The list representing the current try (that is an empty row awaiting letters)
    const filled: LetterGuess[] = [...guess, ...(new Array(game.answer.length - guess.length)).fill(" ")].map((char, idx) => 
          ({letter: {character: char, index: idx}, kind: valid?"untried":"absent"}))
    //The list holding the empty rows of the board
    const empties = fillGuesses([], game.maxGuesses - game.guesses.length - 1).map((guess:string) => 
          stringToWord(guess).map((l:Letter) => ({letter: l, kind: 'untried'})))
    const allGuesses: LetterGuess[][] = (guesses.length>=game.maxGuesses)?guesses:[...guesses, filled, ...empties]

    //The share string gets computed only at the end of the game
    if(guesses.length==game.maxGuesses){
        share = `Answer: ${game.answer}\nAttempts: ${game.maxGuesses}\n\n`
        allGuesses.map((guess)=>{
            guess.map((letter)=>{
                share = appendGuess(letter)
            })
            share+="\n"
        })
    }

    return (
        <View style={{margin: 8}}>
                {allGuesses.map(
                    g =>
                        <BoardRow letters={g}/>
                    )
                }
        </View>
    )
}

const halves = <A,>(list:A[]): [A[],A[]] => {
  if (list.length===1) return [list, []]
  const half =  list.length / 2
  const left =  list.slice(0, Math.ceil(half))
  const right = list.slice(-Math.floor(half))
  return [left, right]
}

// the key takes all the guess hints, and lays them out in two columns
const MultiKey = ({guesses, onPress}:{guesses: LetterGuess[], onPress: StrCallback}) => {
  // we split our list of guesses in two columns
  // there's a special when there is only one game, we just put the same view in two positions
  const [l,r] = halves(guesses)
  const left =  l.map((g) => <View style={[background(g), {flex: 1}]} />)
  const right = r.map((g) => <View style={[background(g), {flex: 1}]} />)
  

  return (
  <Pressable style={[styles.keyContainer]} onPress={() => onPress(guesses[0].letter.character)}>
      <View style={styles.front}>
          <Text style={styles.keyText}>{guesses[0].letter.character}</Text>
      </View>
      <View style={styles.back} >
          <View style={[{flex: 1}]}>{left}</View>
          <View style={[{flex: 1}]}>{right.length===0?left:right}</View>
      </View>
  </Pressable>
  )
}

// you have [[a, b, c],[a, b, c],[a, b, c],[a, b, c]]
// you want [[a, a, a, a], [b, b, b, b], [c, c, c, c]]
// this is what the zip function does
// we use it to group together the guess hints for each letter
const zip = <A,>(arrays:A[][]):A[][] => arrays[0].map((val, idx) => arrays.map(array => array[idx]))

// the keyboard now takes multiple games as a prop
// and computes the colors for each game, using the function from assignment 1
const KeyBoard = ({games, valid, empty, onPress, onEnter, onDelete}:
        {games: Wordle[], valid: boolean, empty:boolean, onPress: StrCallback, onEnter: Callback, onDelete: Callback}) => {
    
    const rows =  ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"]
    // we have to group the guesses by letters, and for that we use the "zip" function
    const coloredRows:LetterGuess[][][] = rows.map(r => zip(games.map(game => bestGuesses(r, game.guesses, game.answer))))
    const toKey = (guesses: LetterGuess[]) => <MultiKey guesses={guesses} onPress={onPress} key={"key"+guesses.toString()}/>
    const toKeys = (row: LetterGuess[][]) => <View style={styles.row} key={row.toString()}>{row.map(g => toKey(g))}</View>

    return (
      <View>
          {coloredRows.map(row => toKeys(row))}
          <View style={[styles.row, styles.centered]}>
              <Button title="enter" onPress={onEnter} disabled={!valid}/>
              <Button title="delete" onPress={onDelete} disabled={empty}/>
              <Button title="share" onPress={onShare} disabled={!areWordlesDone(games)}/>
          </View>
      </View>)
}

const areWordlesDone = (games: Wordle[]):boolean =>{
    let done = false;
    games.forEach(game => done = game.guesses.length == 6);
    return done;
}

const Bar = ({title, percent, color}:{title: string, percent: number, color: "red"|"green"}) => (
  <View style={[styles.row, {height: 20}]} >
      <Text style={{flex: 20}}>{title}</Text>
      <View style={[styles.bordered, {backgroundColor: color, flex: percent}]}/>
      <View style={{flex: 100 - percent}}/>
  </View>
)

const Statistics = ({stats, max}:{stats: number[], max: number}) => {
    const buckets = [... Array(max+1).keys()].map(num =>stats.filter(s => s === num))
    const maximum = stats.length===0?1:stats.length
    const percents = buckets.map(b => Math.floor(100 * (b.length / maximum) ))
    console.log("test");
    return (
      <View>
        {percents.map((p, idx) => {
              const lost = (idx === 0)
              return <Bar title={lost?"lost":`${idx} tries`} percent={p} color={lost?"red":"green"} key={"statistics_"+idx}/> })}
      </View>
    )
}

// we have one of these components for each game, instead of one in total
const WordleSettings = ({init, gameIndex, list, onSelect}:{init: string, gameIndex: number, list: string[], onSelect: (arg1: string, arg2: number) => void}) => {
  const [num, setNum] = useState<string>("")
  const [word, setWord] = useState<string>(init)
  
  const validateNum = (input: string) => {
      const theNum = parseInt(input)
      const theWord = answers[theNum]
 
      if (theWord !== undefined) {
          setNum(input)
          setWord(theWord)
          onSelect(theWord, gameIndex)
      }
      if(input === "") {
          setNum("")
          setWord(init)
          onSelect(init, gameIndex)
      }
  }

  const validateWord = (input: string) => {
      const findPrefixIndex = (prefix: string, words: string[]):number=> words.findIndex(w => w.startsWith(prefix))
      const index = findPrefixIndex(input, answers)
      if (index > -1) {
          setNum("" + index)
          setWord(input)
          onSelect(list[index], gameIndex)
      }
   }

  return (

    <Card style={styles.card}>
        <View style={[styles.row, styles.centered]}>
            <View>
                <Text>Word:  </Text>
                <Text>Number (0–{answers.length - 1}):</Text>
            </View>
            <View>
                <TextInput style={[styles.textField, styles.bordered]} autoCapitalize = {"characters"} value={word} onChangeText={validateWord}/>
                <TextInput style={[styles.textField, styles.bordered]} value={num} keyboardType="numeric" onChangeText={validateNum}/>
            </View>
        </View>
    </Card>
 
  )
}



type Stats = {game: string, attempts: number}[]

// the settings screen allows to add multiple "individual settings" components,
// and gathers the information from all of them
// the callback of the settings changes, since it needs to be able to handle multiple games
// also, the format of the statistics changes a bit, since we need to store the type as well
// otherwise we would mix wordle and dordle statistics
const Settings = ({onStart, statistics}:{onStart: MultiWordleCallback, statistics: Stats}) => {
  const init = "Random"
  const [words, setWords] = useState<string[]>([init])
  
  const selectWord = (word: string, index: number) => {
    let newWords = [...words]
    newWords[index] = word
    setWords(newWords)
  }

  //Initialises the game(s) with one or more random answers
  const startGame = () => {
    const gameAnswers:string[] = words.map(word =>  word===init?randomWord(answers):word)
    console.log(gameAnswers)
    const attempts = 5 + gameAnswers.length
    const games = gameAnswers.map(answer => 
          (
              {
                  guesses: [],
                  answer: answer,
                  words: answers,
                  valid_words: allwords,
                  maxGuesses: attempts,
                  mode: "easy",
                  statistics:[]
              }
          )
    )
    onStart(games)
  }

  const addGame = () => setWords([...words, init])
  const removeGame = () => setWords(words.slice(0,-1))
  const gameType = gameName(words)
  const gameStats = statistics.filter(st => st.game === gameType).map(st => st.attempts)

  return (
  <ScrollView style={styles.container} contentContainerStyle={{justifyContent: 'center'}} >
    <Card style={styles.card}>
        <Text style={styles.paragraph}>{gameType} Settings</Text>
        {words.map((word, index) => <WordleSettings init={init} gameIndex={index} list={answers} onSelect={selectWord} key={"game_"+index}/> )}
        <Button title="Add game" onPress={addGame} />
        <Button title="Remove game" onPress={removeGame} disabled={words.length <= 1}/>
        <Button title="Start" onPress={startGame} />
    </Card>
    <Card style={styles.card}>
        <Text style={styles.paragraph}>{gameType} Statistics</Text>
        <Statistics stats={gameStats} max={words.length + 5}/>
    </Card>
  </ScrollView>
  )
}

// you win if you win all the games
// you lose as soon as you lose one of the games
const multiStatus = (games: Wordle[]): "win"|"lost"|"next" => {
    const gameStatuses = games.map(game => status(game))
    if (gameStatuses.every(status => status === "win")) return "win"
    if (gameStatuses.some(status => status === "lost")) return "lost"
    return "next"
}

const gameName = (games: Wordle[]): string => {
      const names = ["Wordle", "Dordle", "Triordle", "Quordle", "Quindle", "Sexordle", 
      "Heptordle", "Octordle", "Novordle", "Decordle", "Undecordle", "Dodecordle"]
      if (games.length >= names.length) return "WayTooLongordle"
      return names[games.length - 1]
}
 
 // some differences with the single-game case:
 // we have multiple games, and the different winning condition
 // each game is layout in one of two columns, with a bit of space in between
 // each column can contain multiple games
 // layout has special cases for one game only, or for an uneven amount of games
 // we need to make sure that we can scroll, otherwise if you have too many games, you don't see anything
const MultiWordleGame = ({startGames, onBack}:{startGames: Wordle[], onBack: MultiWordleCallback}) => {
  const [guess, setGuess] = useState<string>("")
  const [games, setGames] = useState<Wordle[]>(startGames)
  const prefixValid = isValidPrefix(guess, games[0].valid_words)
  const enterValid = isValidGuess(guess, games[0])

  const keyPress = (char:string) => setGuess(guess + char)
  
  const backspace = () => setGuess(guess.slice(0, -1))
  const addGuess = () => {
    setGames(games.map(game => status(game) === "next"?({...game, guesses: [...game.guesses, guess]}):game))
    setGuess("")
  }

  const message = () => {
      switch(multiStatus(games)) {
          case "win": return "You won! Congratulations :-)"
          case "lost":  return "Sorry, you lost :-( \n the missing words were: " + games.filter(game => status(game) === "lost").map(game => game.answer)
          default: return ""
      }
  }


  const [l, r] = halves(games)
  const alone = r.length === 0
  const shorter = r.length < l.length

  return (
   <View style={styles.container}>
          <Text style={styles.paragraph}>{gameName(games)}</Text>
          <Text style={styles.paragraph}>{message()}</Text>
          <ScrollView>
          <Card style={styles.card}>
          <View style={styles.row}>
              <View style={{flex: 10}}>
                  {l.map((game) => <Board game={game} guess={guess} valid={prefixValid} />)}
              </View>
              {alone?
              null:(
              <View style={{flex: 10}}>
                  {r.map((game) => <Board game={game} guess={guess} valid={prefixValid} />)}
                  {shorter?<View style={{flex: 1}}/>:null}
              </View>)}
          </View>
          </Card>
          </ScrollView>
          <Card style={styles.card}>
          <KeyBoard games={games} valid={enterValid} empty={guess === ""} onPress={keyPress} onDelete={backspace} onEnter={addGuess}/>
          </Card>

          <Button title="back" onPress={() => onBack(games)} />
    </View>
  )
}
// the differences are that the callbacks take multiple games now, instead of only one
// and the change of the format of the statistics
const App = () => {
  const [games, setGames] = useState<Wordle[]>([])
  
  const [stats, setStats] = useState<Stats>([])

  const startPlaying = (games: Wordle[]) => {
    setGames(games)
  }

  const stopPlaying = () => setGames([])

  const getStats = (games: Wordle[]) => {
      const game = gameName(games)
      const attempts = games.reduce((prev, curr) => {
        return Math.max(prev, curr.guesses.length)
        }, 0)
      switch (multiStatus(games)) {
          case "next": break; 
          case "lost": setStats([...stats, {game, attempts: 0}]); break;
          case "win": setStats([...stats,  {game, attempts}]); break;
      }
      stopPlaying()
  }

  return (
        games.length===0?
        <Settings onStart={startPlaying} statistics={stats}/>:
        <MultiWordleGame onBack={getStats} startGames={games}/>
  )
}

export default App

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Constants.statusBarHeight,
    backgroundColor: '#ecf0f1',
    padding: 8,
  },
  row: {
    flexDirection: "row",
    justifyContent: "center"
  },
  centered: {
    justifyContent: "center",
  },
  card: {
    margin: 10,
    padding: 8,
  },
  paragraph: {
    margin: 24,
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  boardCell: {
    flex: 1,
    borderColor: "black",
    borderWidth: 1,
    margin: 2,
    width: 35,
    height: 25,
    justifyContent: "center",
  },
  key: {
    flex: 1,
    borderColor: "black",
    borderWidth: 1,
    margin: 2,
    width: 30,
    height: 40,
    justifyContent: "center",
  },
  keyText: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  correct: {
    backgroundColor: "green",
  },
  misplaced: {
    backgroundColor: "yellow",
  },
  absent: {
    backgroundColor: "red"
  },
  untried: {
    backgroundColor: "grey"
  },
  keyContainer: {
    flex: 1,
    alignItems: 'center',
    height: 40,
    // height: '100%',
    borderColor: "black",
    borderWidth: 1,
    margin: 2,
    justifyContent: 'center',
  },
  front: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  back: {
    flexDirection: 'row',
    left: 0,
    top: 0,
    position: 'absolute',
    opacity: 0.6,
    width: '100%',
    height: '100%'
  },
  bordered: { borderColor: "black", borderWidth: 1 },
  textField: {width: 80}
});



