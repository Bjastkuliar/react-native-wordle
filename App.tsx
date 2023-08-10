// this is a version of wordle that support multiple games (2, 3, 4, 5, ...)
// it is very similar to the wordle version with one game
// here we highlight only the differences between the two versions
// for detailed comments of the components of the single game version, refer to:
// https://snack.expo.dev/@rrobbes/wordle-solution


// sometimes typescript fails to process these two modules, but they work fine in javascript
import {allwords} from './allwords';
import {answers} from './answers';
import {
    bestGuesses,
    fillGuesses,
    isValidGuess,
    isValidPrefix,
    Letter,
    LetterGuess,
    randomWord,
    rateGuesses,
    status,
    stringToWord,
    Wordle
} from './wordle';
import React, {useEffect, useState} from 'react';
import {Button, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View, Modal} from 'react-native';
import Constants from 'expo-constants';
import {Card} from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import QRCode from 'qrcode';
import {SvgXml} from 'react-native-svg';

// one change is that we do not use files for reading the words anymore, for simplicity
// the resources are defined in TypeScript modules

type StrCallback = (arg: string) => void
type Callback = () => void
type MultiWordleCallback = (arg: Wordle[]) => void

interface FetchedWord {
    word: string,
    partOfSpeech: string,
    definition: string,
    example: string|null
}

interface WordleChallenge {
    wordles: Wordle[],
    wordleDetails: FetchedWord[]
}

const WORDNIK_API_KEY: string = "uoqnv60vosqot1gurgcgln5e31u3qfaq8qfczhlplgg8g9v3h";
const INIT = "Random"

//DONE Sharing (1 pts)
const onShare = async () => {
    try {
        await Share.share({
            message:""+share,
        });
    } catch (error) {
        console.error(error)
    }
};

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

let board_key = 0;
const BoardRow = ({letters}:{letters: LetterGuess[]}) => (
  <View style = {styles.row}>{letters.map(l => <BoardLetter guess={l} key={"board_letter_"+board_key++}/>)}</View>
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
          stringToWord(guess).map((l:Letter) : LetterGuess => ({letter: l, kind: 'untried'})))
    const allGuesses : LetterGuess[][] = (guesses.length>=game.maxGuesses)?guesses:[...guesses, filled, ...empties]

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

    let boardRowCount = 0;

    return (
        <View style={{margin: 8}}>
                {allGuesses.map(
                    g =>
                        <BoardRow letters={g} key={"board_row_"+boardRowCount++}/>
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
  const [l,r] = halves(guesses);
  let l_count = 0, r_count= 0;
  const left =  l.map((g) => <View style={[background(g), {flex: 1}]} key={"l_key_"+l_count++} />)
  const right = r.map((g) => <View style={[background(g), {flex: 1}]} key={"r_key_"+r_count++}/>)
  

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
// this is what the zip function does,
// we use it to group together the guess hints for each letter
const zip = <A,>(arrays:A[][]):A[][] => arrays[0].map((val, idx) => arrays.map(array => array[idx]))

// the keyboard now takes multiple games as a prop
// and computes the colors for each game, using the function from assignment 1
const KeyBoard = ({games, valid, empty, onPress, onEnter, onDelete}:
        {games: Wordle[],
            valid: boolean,
            empty:boolean,
            onPress: StrCallback,
            onEnter: Callback,
            onDelete: Callback}) => {
    
    const rows =  ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"]
    // we have to group the guesses by letters, and for that we use the "zip" function
    const coloredRows:LetterGuess[][][] = rows.map(r => zip(games.map(game => bestGuesses(r, game.guesses, game.answer))))
    let row_num = 0, key_num = 0;
    //Keyboard key
    const toKey = (guesses: LetterGuess[]) => <MultiKey guesses={guesses} onPress={onPress} key={"key_"+key_num++}/>
    //Keyboard row
    const toKeys = (row: LetterGuess[][]) => <View style={styles.row} key={"keyboard_row_"+row_num++} >{row.map(g => toKey(g))}</View>

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
const Settings = ({onStart, statistics,onWordsFetched,setStats}:{onStart: MultiWordleCallback, statistics: Stats,onWordsFetched:React.Dispatch<React.SetStateAction<FetchedWord[]>>,setStats:React.Dispatch<React.SetStateAction<Stats>>}) => {

  const [words, setWords] = useState<string[]>([INIT]);

  const selectWord = (word: string, index: number) => {
    let newWords = [...words]
    newWords[index] = word
    setWords(newWords)
  }

  //Initialises the game(s) with one or more random answers
  const startGame = () => {
      const gameAnswers:string[] = words.map(word =>  word===INIT?randomWord(answers):word)
      fetchWords(gameAnswers).then(fetchedWords => onWordsFetched(fetchedWords))
      console.log("Game answers: "+gameAnswers)

      //TODO Note: max attempts here
      const attempts = 5 + gameAnswers.length
      const games: Wordle[] = gameAnswers.map(answer =>
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

  const addGame = () => setWords([...words, INIT])
  const removeGame = () => setWords(words.slice(0,-1))
  const gameType = gameName(words)
  const gameStats = statistics.filter(st => st.game === gameType).map(st => st.attempts)

  return (
  <ScrollView style={styles.container} contentContainerStyle={{justifyContent: 'center'}} >
    <Card style={styles.card}>
        <Text style={styles.paragraph}>{gameType} Settings</Text>
        {words.map((word, index) => <WordleSettings init={INIT} gameIndex={index} list={answers} onSelect={selectWord} key={"game_"+index}/> )}
        <Button title="Add game" onPress={addGame} />
        <Button title="Remove game" onPress={removeGame} disabled={words.length <= 1}/>
        <Button title="Start" onPress={startGame} />
    </Card>
    <ChallengeSettings/>
    <Card style={styles.card}>
        <Button title={"Clear Statistics"} onPress={()=> clearData(setStats)}/>
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

const gameName = (games: string[]|Wordle[]): string => {
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
const MultiWordleGame = ({startGames, onBack,wordDetails}:{startGames: Wordle[], onBack: MultiWordleCallback, wordDetails:FetchedWord[]}) => {
  const [guess, setGuess] = useState<string>("");
  const [games, setGames] = useState<Wordle[]>(startGames);
  const [msgBox, updateMessage] = useState<string>("");
  const prefixValid = isValidPrefix(guess, games[0].valid_words);
  const enterValid = isValidGuess(guess, games[0]);

  //DONE Fix the ArrayOutOfBound Exception
  /*Performs a check before appending a new letter,
  * if the letter to be appended would extend the guess over
  * the maximum length of a guess, it is logged in the console instead
  * and the last letter is not added.*/
  const keyPress = (char:string) => {
      if(guess.length+1<startGames[0].maxGuesses){
          setGuess(guess + char)
      } else {
          console.log("User tried to enter one more character!")
      }
  }
  
  const backspace = () => setGuess(guess.slice(0, -1))
  const addGuess = () => {
    setGames(games.map(game => status(game) === "next"?({...game, guesses: [...game.guesses, guess]}):game))
    setGuess("")
  }

  const message = () => {
      let msg_to_display = ""
      //DONE Dictionary API integration (mandatory, 2pt)
      //DONE Display word definition upon finishing game
      switch(multiStatus(games)) {
          case "win": {
              msg_to_display = "You won! Congratulations :-)"+"\n"
              wordDetails.forEach(word=>{
                  msg_to_display+=word.definition+"\n"
              })
              break;
          }
          case "lost":  {
              let lostWords = games.filter(game => status(game) === "lost").map(game => game.answer)
              msg_to_display = "Sorry, you lost :-( \n the missing words were: \n"
              lostWords.forEach(word => {
                  let definition = ""
                  wordDetails.forEach(wordDetail => {
                      if(wordDetail.word==word){
                          definition = wordDetail.definition
                      }
                  })
                  msg_to_display+=word+": "+definition+"\n"
              })
              break;
          }
          default: {
              msg_to_display= msgBox
              break;
          }
      }
      return msg_to_display;
  }

  const [l, r] = halves(games)
  const alone = r.length === 0
  const shorter = r.length < l.length;
  let l_count = 0, r_count  = 0;

  const displayClues = (desperate: boolean) => {
      let msg = ""
      if(desperate) {
          msg += "Desperate clues: \n"
          for(let i = 0; i<wordDetails.length;i++){
              if(wordDetails[i].example!= undefined){
                  msg+= "Word "+i+1+" :"+wordDetails[i].example+"\n"
              } else {
                  console.log("Example for word "+i+" is unavailable!");
              }
          }
      } else {
          msg += "Clues: \n"
          for(let i = 0; i<wordDetails.length;i++){
              if(wordDetails[i].partOfSpeech!= undefined){
                  msg+= "Word "+i+1+" :"+wordDetails[i].partOfSpeech+"\n"
              } else {
                  console.log("Part of Speech for word "+i+" is unavailable!");
              }
          }
      }
      updateMessage(msg)
  }

  return (
   <View style={styles.container}>
          <Text style={styles.paragraph}>{gameName(games)}</Text>
          <Text style={styles.paragraph}>{message()}</Text>
          <ScrollView>
          <Card style={styles.card}>
          <View style={styles.row}>
              <View style={{flex: 10}}>
                  {l.map((game) => <Board game={game} guess={guess} valid={prefixValid} key={"l_game_"+l_count++}/>)}
              </View>
              {alone?
              null:(
              <View style={{flex: 10}}>
                  {r.map((game) => <Board game={game} guess={guess} valid={prefixValid} key={"r_game_"+r_count++}/>)}
                  {shorter?<View style={{flex: 1}}/>:null}
              </View>)}
          </View>
          </Card>
          </ScrollView>
          <Card style={styles.card}>
              <View style={[styles.row, styles.centered]}>
                  {//DONE Add "clue" button as well as displaying said clue
                  }
                  <Button title={"clue"} onPress={()=> displayClues(false)}/>

                  {
                      //DONE Add a "desperate clue" button as well as displaying said clue
                  }
                  <Button title={"Desperate clue"} onPress={() => displayClues(true)}/>
              </View>
          <KeyBoard games={games} valid={enterValid} empty={guess === ""} onPress={keyPress} onDelete={backspace} onEnter={addGuess}/>
          </Card>

          <Button title="back" onPress={() => onBack(games)} />
    </View>
  )
}
// the differences are that the callbacks take multiple games now, instead of only one
// and the change of the format of the statistics
const App = () => {
  const [games, setGames] = useState<Wordle[]>([]);
  const [fetchedWords, onWordsFetched] = useState<FetchedWord[]>([]);
  const [stats, setStats] = useState<Stats>([]);

    //DONE Persistence (1 pts)
    /*The use effect hook is updating the statistics only once at application startup*/
  useEffect(()=>{
      getData().then(statistics => {
          setStats(statistics)
      });
  },[]);

  const startPlaying = (games: Wordle[]) => {
    setGames(games)
  }

  const stopPlaying = () => {
      setGames([])
      setData(stats).then(()=> console.log("Updated statistics with last game."));
  }

  const getStats = (games: Wordle[]) => {
      const game = gameName(games)
      const attempts = games.reduce((prev, curr) => {
        return Math.max(prev, curr.guesses.length)
        }, 0)
      switch (multiStatus(games)) {
          case "next": break; 
          case "lost": setStats([...stats, {game, attempts: 0}]);break;
          case "win": setStats([...stats,  {game, attempts}]);break;
      }
      stopPlaying();
  }

  return (
        games.length===0?
        <Settings onStart={startPlaying} statistics={stats} onWordsFetched={onWordsFetched} setStats={setStats}/>:
        <MultiWordleGame onBack={getStats} startGames={games} wordDetails={fetchedWords}/>
  )
}

export default App

//TO-DO LIST
//DONE Fix the ArrayOutOfBound Exception
//DONE Dictionary API integration (mandatory, 2pt)
//DONE Persistence (1 pts)
//DONE Sharing (1 pts)
//TODO Haptics (1 pts)
//TODO Challenges (2 pts)
//TODO Advanced Dictionary integration (2 pts)
//TODO Dordle: eternal edition (2 pts)
//TODO Advanced challenges (4 pts, for ambitious students!)

//TOTAL COUNT OF CURRENT POINTS: 4 / 10

//DONE Persistence (1 pts)
const setData = async (stats: Stats) => {
    const jsonValue = JSON.stringify(stats);
    try {
        await AsyncStorage.setItem('stats', jsonValue);
        console.log("Set statistics successfully!");
    } catch (e) {
        // saving error
        console.error(e);
    }
    console.log('updated the statistics with: ' + jsonValue);
};

const getData = async (): Promise<Stats> => {
    let stats : Stats = [];
    try {
        const jsonValue = await AsyncStorage.getItem('stats');
        if(jsonValue==null){
            console.log("Statistics are empty!");
        } else {
            console.log("Retrieved statistics successfully!");
            stats = JSON.parse(jsonValue);
        }
        console.log("Current statistics: "+jsonValue)
    } catch (e) {
        // error reading value
        console.error(e);
    }
    return stats;
};

const clearData = async (setStats: React.Dispatch<React.SetStateAction<Stats>>) => {
    try {
        setStats([])
        await AsyncStorage.removeItem('stats')
    } catch (e){
        console.error(e)
    }
    console.log("Cleared statistics!")
}

//DONE Dictionary API integration (mandatory, 2pt)
//DONE Implement word fetching
//DONE Implement UI actions on fetched data

//queries Wordnik for a word
async function fetchWordData(word:string){
    const url : string = "https://api.wordnik.com/v4/word.json/"+word.toLowerCase()+"/definitions?limit=200&includeRelated=false&sourceDictionaries=all&useCanonical=false&includeTags=false&api_key="+WORDNIK_API_KEY;
    const response = await fetch(url);
    return await response.json();
}

async function fetchWords(gameAnswers: string[]): Promise<FetchedWord[]>{
    let fetchedWords: FetchedWord[] = [];
    gameAnswers.forEach(answer => {
        fetchCompleteWord(answer).then(fetchedWord =>
            fetchedWords.push(fetchedWord)
        )
    })
    return fetchedWords;
}

//processes the response received from wordnik into a FetchedWord object
async function fetchCompleteWord(theWord: string): Promise<FetchedWord> {

    //needed in order to prevent an overflow of requests to the api
    let wordDetails: FetchedWord = {
        word : "Random",
        partOfSpeech: "undefined",
        definition: "undefined",
        example: null
    }
    let definitionIndex = 0, score = 0, maxScore = 0, maxScoreIndex = 0;
    console.log("Fetching word definition for "+theWord)
    const responseJson = await fetchWordData(theWord);
    while(responseJson[definitionIndex]!= undefined){
        score = 0;
        /*responseJson is a list of different definitions,
        * I chose to try and sort out the "best one" since many
        * of them are missing the definition and/or the examples.*/
        if(responseJson[definitionIndex].text!=undefined){
            score ++;
        }
        if(responseJson[definitionIndex].partOfSpeech!=undefined){
            score++
        }
        if(responseJson[definitionIndex].example!= undefined){
            score++
        }
        if(score> maxScore){
            maxScore = score;
            maxScoreIndex = definitionIndex;
        }
        //if one definition has all three necessary components, we quit searching
        if(maxScore==3){
            break;
        }

        definitionIndex++
    }
    wordDetails.definition=responseJson[maxScoreIndex].text;
    wordDetails.partOfSpeech=responseJson[maxScoreIndex].partOfSpeech;
    wordDetails.example=responseJson[maxScoreIndex].example;
    console.log("Word: "+wordDetails.word)
    console.log("PartOfSpeech: "+wordDetails.partOfSpeech)
    console.log("Definition: "+wordDetails.definition)
    console.log("Example: "+wordDetails.example)
    wordDetails.word = theWord;
    return wordDetails;
}

//TODO Challenges (2 pts)
//The user picks a word from the list of eligible words (or two, for Dordle).
//The application builds a Javascript object that represents the type of game to play and the word or words to guess (this depends on how your application works)
//This object is converted to a string url, and encoded as a QRCode, for instance using this package: https://www.npmjs.com/package/react-native-qrcode-svg
//The QR Code is displayed on screen, a second user can scan it with their phone camera
//TODO This opens the application on the other phone, which receives the data, creates the game, and starts it
// If the game is won, the user gets the option to issue a challenge back
const ChallengeSettings = () => {
    const [challengeWords, setChallengeWords] = useState<string[]>([INIT]);
    const [fetchedChallenges, setFetchedChallenges] = useState<FetchedWord[]>([])
    const[challenge, addChallenge] = useState<string>("");
    const addGame = () => setChallengeWords([...challengeWords, INIT])
    const removeGame = () => setChallengeWords(challengeWords.slice(0,-1))
    const selectWord = (word: string, index: number) => {
        let newWords = [...challengeWords]
        newWords[index] = word
        setChallengeWords(newWords)
    }
    const setChallenge = () => {
        const gameAnswers:string[] = challengeWords.map(word =>  word===INIT?randomWord(answers):word)
        fetchWords(gameAnswers).then(fetchedWords => setFetchedChallenges(fetchedWords))
        console.log("Challenge(s) answers: "+gameAnswers)

        //TODO Note: max challenge attempts here
        const attempts = 5 + gameAnswers.length
        const games: Wordle[] = gameAnswers.map(answer =>
            (
                {
                    guesses: [],
                    answer: answer,
                    words: [],
                    valid_words: [],
                    maxGuesses: attempts,
                    mode: "easy",
                    statistics:[]
                }
            )
        )
        const challengeObject : WordleChallenge = {
            wordles: games,
            wordleDetails: fetchedChallenges
        }
        sendChallenge(JSON.stringify(challengeObject),addChallenge)
    }

    return (
        <Card style={styles.card}>
            <Text style={[styles.paragraph]}>Challenge setup</Text>
            {challengeWords.map((word, index) => <WordleSettings init={INIT} gameIndex={index} list={answers} onSelect={selectWord} key={"game_"+index}/> )}
            <Button title="Add game" onPress={addGame} />
            <Button title="Remove game" onPress={removeGame} disabled={challengeWords.length <= 1}/>
            {challenge==""?<Button title={"Challenge!"} onPress={setChallenge}/>:
                <Modal style={styles.modalView} animationType={"fade"} onRequestClose={() => addChallenge("")}>
                    <View style={styles.column}>
                        <View style={styles.centeredView}>
                            <SvgXml xml={challenge} width="90%" height="90%" />
                            <Button title={"Back to the App"} onPress={() => addChallenge("")}/>
                        </View>

                    </View>
                </Modal>
            }
        </Card>
    )
}

function sendChallenge(challengeObject: string, setQR: React.Dispatch<React.SetStateAction<string>>) {
    const link = "wordle://"+ JSON.stringify(challengeObject)
    console.log(link)

    QRCode.toString(link, {type: 'svg' /* other options */ })
        .then(setQR)
        .catch(() => {
            console.error('Unable to render SVG Code');
            // Do something with the error
        });
}



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
    column: {
      flexDirection:"column",
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
  textField: {width: 80},
    centeredView: {
        justifyContent: 'center',
        alignItems: 'center',
        marginVertical: 22,
    },
    modalView: {
        margin: 20,
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 35,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    }
});



