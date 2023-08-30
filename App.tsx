// this is a version of wordle that support multiple games (2, 3, 4, 5, ...)
// it is very similar to the wordle version with one game
// here we highlight only the differences between the two versions
// for detailed comments of the components of the single game version, refer to:
// https://snack.expo.dev/@rrobbes/wordle-solution


// sometimes typescript fails to process these two modules, but they work fine in javascript
import {allwords} from './allwords';
import {answers} from './answers';
//TODO implement a custom version of wordle which eliminates the need for the allwords/answers files
// since random word choice and validation are executed by Wordnik
import {
    bestGuesses,
    fillGuesses,
    Letter,
    LetterGuess,
    rateGuesses,
    status,
    stringToWord,
    Wordle
} from './wordle';
import React, {useEffect, useState} from 'react';
import {Button, Modal, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View} from 'react-native';
import Constants from 'expo-constants';
import {Card} from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
// @ts-ignore
import QRCode from 'qrcode';
import {SvgXml} from 'react-native-svg';

type StrCallback = (arg: string) => void
type Callback = () => void
type MultiWordleCallback = (arg: Wordle[]) => void

interface FetchedWord {
    word: string,
    partOfSpeech: string,
    definition: string,
    example: string | null
}

//this is my personal API key, it allows 5 API calls per type per minute
const WORDNIK_API_KEY: string = "uoqnv60vosqot1gurgcgln5e31u3qfaq8qfczhlplgg8g9v3h";
const INIT: string = "Random"

const GUESSES_TO_SAVE: number = 2
const MIN_LENGTH: number = 5;
const MAX_ATTEMPTS: number = 10;
const MAX_DORDLE_LENGTH: number = 8;
const STRING_PLACEHOLDER: string = "[BLANK]"

//sample word which is used in case of exceeding the max API requests
const SAMPLE_WORD = {
    id: -1,
    word: "random"
};

//DONE Sharing (1 pts)
const onShare = async () => {
    try {
        await Share.share({
            message: "" + share,
        });
    } catch (error) {
        console.error(error)
    }
};

let share: string | null = null

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
        case "correct":
            return styles.correct
        case "absent":
            return styles.absent
        case "misplaced":
            return styles.misplaced
        default:
            return styles.untried
    }
}

const BoardLetter = ({guess}: { guess: LetterGuess }) => (
    <View style={[styles.boardCell, background(guess)]}><Text
        style={styles.keyText}>{guess.letter.character}</Text></View>
)

let board_key = 0;
const BoardRow = ({letters}: { letters: LetterGuess[] }) => (
    <View style={styles.row}>{letters.map(l => <BoardLetter guess={l} key={"board_letter_" + board_key++}/>)}</View>
)

const Board = ({game, guess}: { game: Wordle, guess: string }) => {
    //The list holding all the present guesses
    const guesses = game.guesses.map((guess: string) =>
        rateGuesses(guess, game.answer.toUpperCase()))
    //The list representing the current try (that is an empty row awaiting letters)
    const filled: LetterGuess[] = [...guess, ...(new Array(game.answer.length - guess.length)).fill(" ")].map((char, idx) =>
        ({letter: {character: char, index: idx}, kind: "untried"}))
    //The list holding the empty rows of the board
    const empties = fillGuesses([], game.maxGuesses - game.guesses.length - 1, game.answer.length).map((guess: string) =>
        stringToWord(guess).map((l: Letter): LetterGuess => ({letter: l, kind: 'untried'})))
    const allGuesses: LetterGuess[][] = (guesses.length >= game.maxGuesses) ? guesses : [...guesses, filled, ...empties]

    //The share string gets computed only at the end of the game
    if (guesses.length == game.maxGuesses) {
        share = `Answer: ${game.answer}\nAttempts: ${game.maxGuesses}\n\n`
        allGuesses.map((guess) => {
            guess.map((letter) => {
                share = appendGuess(letter)
            })
            share += "\n"
        })
    }


    //needed for unique row key
    let boardRowCount = 0;

    return (
        <View style={{margin: 8}}>
            {allGuesses.map(
                g =>
                    <BoardRow letters={g} key={"board_row_" + boardRowCount++}/>
            )
            }
        </View>
    )
}

const halves = <A, >(list: A[]): [A[], A[]] => {
    if (list.length === 1) return [list, []]
    const half = list.length / 2
    const left = list.slice(0, Math.ceil(half))
    const right = list.slice(-Math.floor(half))
    return [left, right]
}

// the key takes all the guess hints, and lays them out in two columns
const MultiKey = ({guesses, onPress}: { guesses: LetterGuess[], onPress: StrCallback }) => {
    // we split our list of guesses in two columns
    // there's a special when there is only one game, we just put the same view in two positions
    const [l, r] = halves(guesses);
    let l_count = 0, r_count = 0;
    const left = l.map((g) => <View style={[background(g), {flex: 1}]} key={"l_key_" + l_count++}/>)
    const right = r.map((g) => <View style={[background(g), {flex: 1}]} key={"r_key_" + r_count++}/>)


    return (
        <Pressable style={[styles.keyContainer]} onPress={() => onPress(guesses[0].letter.character)}>
            <View style={styles.front}>
                <Text style={styles.keyText}>{guesses[0].letter.character}</Text>
            </View>
            <View style={styles.back}>
                <View style={[{flex: 1}]}>{left}</View>
                <View style={[{flex: 1}]}>{right.length === 0 ? left : right}</View>
            </View>
        </Pressable>
    )
}

// you have [[a, b, c],[a, b, c],[a, b, c],[a, b, c]]
// you want [[a, a, a, a], [b, b, b, b], [c, c, c, c]]
// this is what the zip function does,
// we use it to group together the guess hints for each letter
const zip = <A, >(arrays: A[][]): A[][] => arrays[0].map((val, idx) => arrays.map(array => array[idx]))

// the keyboard now takes multiple games as a prop
// and computes the colors for each game, using the function from assignment 1
const KeyBoard = ({games, valid, empty, onPress, onEnter, onDelete}:
                      {
                          games: Wordle[],
                          valid: boolean,
                          empty: boolean,
                          onPress: StrCallback,
                          onEnter: Callback,
                          onDelete: Callback
                      }) => {

    const rows = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"]
    // we have to group the guesses by letters, and for that we use the "zip" function
    const coloredRows: LetterGuess[][][] = rows.map(r => zip(games.map(game => bestGuesses(r, game.guesses, game.answer.toUpperCase()))))
    let row_num = 0, key_num = 0;
    //Keyboard key
    const toKey = (guesses: LetterGuess[]) => <MultiKey guesses={guesses} onPress={onPress} key={"key_" + key_num++}/>
    //Keyboard row
    const toKeys = (row: LetterGuess[][]) => <View style={styles.row}
                                                   key={"keyboard_row_" + row_num++}>{row.map(g => toKey(g))}</View>

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

const areWordlesDone = (games: Wordle[]): boolean => {
    let done = false;
    games.forEach(game => done = game.guesses.length == 6);
    return done;
}

const Bar = ({title, percent, color}: { title: string, percent: number, color: "red" | "green" }) => (
    <View style={[styles.row, {height: 20}]}>
        <Text style={{flex: 20}}>{title}</Text>
        <View style={[styles.bordered, {backgroundColor: color, flex: percent}]}/>
        <View style={{flex: 100 - percent}}/>
    </View>
)

const Statistics = ({stats, max}: { stats: number[], max: number }) => {
    const buckets = [...Array(max + 1).keys()].map(num => stats.filter(s => s === num))
    const maximum = stats.length === 0 ? 1 : stats.length
    const percents = buckets.map(b => Math.floor(100 * (b.length / maximum)))
    return (
        <View>
            {percents.map((p, idx) => {
                const lost = (idx === 0)
                return <Bar title={lost ? "lost" : `${idx} tries`} percent={p} color={lost ? "red" : "green"}
                            key={"statistics_" + idx}/>
            })}
        </View>
    )
}

// we have one of these components for each game, instead of one in total
const WordleSettings = ({init, gameIndex, list, onSelect}: {
    init: string,
    gameIndex: number,
    list: string[],
    onSelect: (arg1: string, arg2: number) => void
}) => {
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
        if (input === "") {
            setNum("")
            setWord(init)
            onSelect(init, gameIndex)
        }
    }

    const validateWord = (input: string) => {
        const findPrefixIndex = (prefix: string, words: string[]): number => words.findIndex(w => w.startsWith(prefix))
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
                    <Text>Word: </Text>
                    <Text>Number (0–{answers.length - 1}):</Text>
                </View>
                <View>
                    <TextInput style={[styles.textField, styles.bordered]} autoCapitalize={"characters"} value={word}
                               onChangeText={validateWord}/>
                    <TextInput style={[styles.textField, styles.bordered]} value={num} keyboardType="numeric"
                               onChangeText={validateNum}/>
                </View>
            </View>
        </Card>

    )
}


type Stats = { game: string, attempts: number }[]

// the settings screen allows to add multiple "individual settings" components,
// and gathers the information from all of them
// the callback of the settings changes, since it needs to be able to handle multiple games
// also, the format of the statistics changes a bit, since we need to store the type as well
// otherwise we would mix wordle and dordle statistics
const Settings = ({onStart, statistics, onWordsFetched, setStats, setWOTDStatus,setEternalStatus}: {
    onStart: MultiWordleCallback,
    statistics: Stats,
    onWordsFetched: React.Dispatch<React.SetStateAction<FetchedWord[]>>,
    setStats: React.Dispatch<React.SetStateAction<Stats>>,
    setWOTDStatus: React.Dispatch<React.SetStateAction<number>>,
    setEternalStatus: React.Dispatch<React.SetStateAction<number>>
}) => {

    const [words, setWords] = useState<string[]>([INIT]);

    const selectWord = (word: string, index: number) => {
        let newWords = [...words]
        newWords[index] = word
        setWords(newWords)
    }

    //Initialises the game(s) with one or more random answers
    const startGame = () => {
        fetchRandomWords(words).then(games => {
            const gameAnswers: string[] = games.map(wordle => wordle.answer)
            console.log("Game answers: " + gameAnswers)
            fetchWords(gameAnswers).then(fetchedWords => onWordsFetched(fetchedWords))
            onStart(games)
        })
    }

    const addGame = () => setWords([...words, INIT])
    const removeGame = () => setWords(words.slice(0, -1))
    const gameType = gameName(words)
    const gameStats = statistics.filter(st => st.game === gameType).map(st => st.attempts)
    //TODO Fix scrollview (with only one game, the statistics graph is partially cut out)
    return (
        <ScrollView style={styles.container} contentContainerStyle={{justifyContent: 'center'}}>
            <Card style={styles.card}>
                <Text style={styles.paragraph}>{gameType} Settings</Text>
                {words.map((word, index) => <WordleSettings init={INIT} gameIndex={index} list={answers}
                                                            onSelect={selectWord} key={"game_" + index}/>)}
                <Button title="Add game" onPress={addGame}/>
                <Button title="Remove game" onPress={removeGame} disabled={words.length <= 1}/>
                <Button title="Start" onPress={startGame}/>
                <WordOfTheDay onStart={onStart} wordDetails={onWordsFetched} setWOTDStatus={setWOTDStatus}/>
                <EternalSettings onStart={onStart} wordleDetails={onWordsFetched} setEternalStatus={setEternalStatus}/>
            </Card>
            <ChallengeSettings/>
            <Card style={styles.card}>
                <Button title={"Clear Statistics"} onPress={() => clearData(setStats)}/>
                <Text style={styles.paragraph}>{gameType} Statistics</Text>
                <Statistics stats={gameStats} max={words.length + 5}/>
            </Card>
        </ScrollView>
    )
}

/*returns win if all games are won,
* returns lost if at least one game is lost
* otherwise returns next*/
const multiStatus = (games: Wordle[]): "win" | "lost" | "next" => {
    const gameStatuses = games.map(game => status(game))
    if (gameStatuses.every(status => status === "win")) return "win"
    if (gameStatuses.some(status => status === "lost")) return "lost"
    return "next"
}

const gameName = (games: string[] | Wordle[]): string => {
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
const MultiWordleGame = ({startGames, onBack, wordDetails, specialStatus}: {
    startGames: Wordle[],
    onBack: MultiWordleCallback,
    wordDetails: FetchedWord[],
    specialStatus?: number
}) => {
    const [guess, setGuess] = useState<string>("");
    const [games, setGames] = useState<Wordle[]>(startGames);
    const [msgBox, updateMessage] = useState<string>("");
    const enterValid = () => {
        wordnikValid(guess).then(isValid => {
            if (isValid) {
                addGuess()
            } else {
                updateMessage("The guess you entered is not valid!")
            }
        })
    }


    //DONE Fix the invalidArrayLength exception
    /*Performs a check before appending a new letter,
    * if the letter to be appended would extend the guess over
    * the maximum length of a guess, it is logged in the console instead
    * and the last letter is not added.*/
    const keyPress = (char: string) => {
        if (guess.length + 1 <= games[0].answer.length) {
            setGuess(guess + char)
        } else {
            console.log("User tried to enter one more character!")
        }
    }

    const backspace = () => setGuess(guess.slice(0, -1))
    const addGuess = () => {
        setGames(games.map(game => status(game) === "next" ? ({...game, guesses: [...game.guesses, guess]}) : game))
        setGuess("")
    }

    const message = () => {
        let msg_to_display = ""
        //DONE Dictionary API integration (mandatory, 2pt)
        //DONE Display word definition upon finishing game
        switch (multiStatus(games)) {
            case "win": {
                msg_to_display = "You won! Congratulations :-)" + "\n"
                wordDetails.forEach(word => {
                    msg_to_display += word.definition + "\n"
                })
                break;
            }
            case "lost": {
                let lostWords = games.filter(game => status(game) === "lost").map(game => game.answer)
                msg_to_display = "Sorry, you lost :-( \n the missing words were: \n"
                lostWords.forEach(word => {
                    let definition = ""
                    wordDetails.forEach(wordDetail => {
                        if (wordDetail.word == word) {
                            definition = wordDetail.definition
                        }
                    })
                    msg_to_display += word + ": " + definition + "\n"
                })
                break;
            }
            default: {
                msg_to_display = msgBox
                break;
            }
        }
        return msg_to_display;
    }

    const [l, r] = halves(games)
    const alone = r.length === 0
    const shorter = r.length < l.length;
    let l_count = 0, r_count = 0;

    const displayClues = (desperate: boolean) => {
        let msg = ""
        if (desperate) {
            msg += "Desperate clues: \n"
            for (let i = 0; i < wordDetails.length; i++) {
                if (wordDetails[i].example != undefined) {
                    msg += "Word " + i + 1 + " :" + wordDetails[i].example?.replace(wordDetails[i].word, STRING_PLACEHOLDER) + "\n"
                } else {
                    console.log("Example for word " + i + " is unavailable!");
                }
            }
        } else {
            msg += "Clues: \n"
            for (let i = 0; i < wordDetails.length; i++) {
                if (wordDetails[i].partOfSpeech != undefined) {
                    msg += "Word " + i + 1 + " :" + wordDetails[i].partOfSpeech + "\n"
                } else {
                    console.log("Part of Speech for word " + i + " is unavailable!");
                }
            }
        }
        updateMessage(msg)
    }



    //TODO Fix scrollview (many games, the keyboard gets moved downwards and becomes unreachable)
    return (
        <View style={styles.container}>
            <Text style={styles.paragraph}>{gameName(games)}</Text>
            <Text style={styles.paragraph}>{message()}</Text>
            {specialStatus != 2 ? <View>
                <ScrollView>
                    <Card style={styles.card}>
                        <View style={styles.row}>
                            <View style={{flex: 10}}>
                                {l.map((game) => <Board game={game} guess={guess}
                                                        key={"l_game_" + l_count++}/>)}
                            </View>
                            {alone ?
                                null : (
                                    <View style={{flex: 10}}>
                                        {r.map((game) => <Board game={game} guess={guess}
                                                                key={"r_game_" + r_count++}/>)}
                                        {shorter ? <View style={{flex: 1}}/> : null}
                                    </View>)}
                        </View>
                    </Card>
                </ScrollView>
                <Card style={styles.card}>
                    <View style={[styles.row, styles.centered]}>
                        <Button title={"clue"} onPress={() => displayClues(false)}/>
                        <Button title={"Desperate clue"} onPress={() => displayClues(true)}
                                disabled={disableDesperateClue(games,wordDetails)}/>
                    </View>
                    <KeyBoard games={games} valid={guess.length >= 5} empty={guess === ""} onPress={keyPress}
                              onDelete={backspace}
                              onEnter={enterValid}/>
                </Card>
            </View> : <ChallengeSettings isChallengeBack={true}/>}
            <Button title="back" onPress={() => onBack(games)}/>
        </View>
    )
}
// the differences are that the callbacks take multiple games now, instead of only one
// and the change of the format of the statistics
const App = () => {
    const [games, setGames] = useState<Wordle[]>([]);
    const [fetchedWords, onWordsFetched] = useState<FetchedWord[]>([]);
    const [stats, setStats] = useState<Stats>([]);

    /**expresses three different statuses for a challenge:
     * - 0: game is not a challenge (will not issue the "challenge back" on win)
     * - 1: game is a challenge in progress
     * - 2: game is a won challenge
     * - 3: game is a challenge but is lost
     * not all statuses are actually used, but they may be useful in case of a future implementation*/
    const [challengeStatus, setChallengeStatus] = useState<number>(0);

    /**specifies whether the game is a word of the day or not and which status it is if so,
     similar to the challengeStatus hook, is mainly used for updating the stored date (and thus disabling the WordOfTheDay
     button:
     * - 0: game is not a WOTD(Word Of The Day)
     * - 1: game is a WOTD in progress
     * - 2: game is a won WOTD (issue the date update)
     * - 3: game is a WOTD but is lost (issue the date update)
     * not all statuses are actually used, but they may be useful in case of a future implementation*/
    const [WOTDStatus, setWOTDStatus] = useState<number>(0)

    /**specifies whether the game is an eternal one or not and which status it is if so,
     it is used for detecting whether a word has been completed or not (and therefore trigger the word change):
     * - 0: game is not an Eternal game
     * - 1: game is an Eternal in progress
     * - 2: game is an Eternal with one word complete (issue the word choice)
     * - 3: game is an Eternal lost game (the game stops)
     * not all statuses are actually used, but they may be useful in case of a future implementation*/
    const [eternalStatus, setEternalStatus] = useState<number>(0)

    //DONE Persistence (1 pts)
    /*The use effect hook is loading the statistics only once at application startup*/
    useEffect(() => {
        getStatistics().then(statistics => {
            setStats(statistics)

        });
        /*If the application is started via link (i.e. via a challenge)
        * Retrieves the challenge encoded and loads the game,
        * otherwise fails (and the "error" is safely catched)*/
        Linking.getInitialURL().then(url => {
            if (url != null) {
                const challengeWordles: Wordle[] | null = receiveChallenge(url)
                if (challengeWordles != null) {
                    setChallengeStatus(1)
                    setGames(challengeWordles)
                    fetchWords(challengeWordles.map(wordle => wordle.answer)).then(fetchedDetails => onWordsFetched(fetchedDetails))
                }
            }
        }).catch(error => console.log("Something went wrong while reading the initial URL! :" + error))
    }, []);

    //The saved statistics are updated each time the statistics useState hook is updated
    useEffect(() => {
        setStatistics(stats).then(() => console.log("Updated statistics with last game."));
    }, [stats]);

    const startPlaying = (games: Wordle[]) => {
        setGames(games)
    }

    const stopPlaying = () => {
        setGames([])
        setChallengeStatus(0)//challenge is done, game is no longer a challenge
    }

    const getStats = (games: Wordle[]) => {
        const game = gameName(games)
        const attempts = games.reduce((prev, curr) => {
            return Math.max(prev, curr.guesses.length)
        }, 0)
        switch (multiStatus(games)) {
            case "next":
                break;
            case "lost":
                setStats([...stats, {game, attempts: 0}]);
                if (challengeStatus == 1) {
                    setChallengeStatus(3)//challenge is lost
                }
                if (WOTDStatus == 1) {
                    setWOTDStatus(3)//WOTD is lost
                    updateDate()
                }
                break;
            case "win":
                setStats([...stats, {game, attempts}]);
                if (challengeStatus == 1) {
                    setChallengeStatus(2)//challenge is won (issue challenge back)
                }
                if (WOTDStatus == 1) {
                    setWOTDStatus(2)//WOTD is won
                    updateDate()
                }
                break;
        }
        stopPlaying();
    }

    function chooseWordleType (){
        if(eternalStatus===0){
            return (<MultiWordleGame startGames={games} onBack={getStats} wordDetails={fetchedWords} specialStatus={challengeStatus}/>)
        } else {
            return (<DordleEternalGame onBack={getStats} startGames={games} wordDetails={fetchedWords} eternalStatus={eternalStatus} setEternalStatus={setEternalStatus}/>)
        }
    }


    return (
        games.length === 0 ?
            <Settings onStart={startPlaying}
                      statistics={stats}
                      onWordsFetched={onWordsFetched}
                      setStats={setStats}
                      setWOTDStatus={setWOTDStatus}
                      setEternalStatus={setEternalStatus}
            /> :
            chooseWordleType()
    )
}


export default App

//DONE Persistence (1 pts)
/**Saves the provided statistics in AsyncStorage with a specific key.
 *
 * @param data the Statistics to be saved*/
const setStatistics = async (data: Stats) => {
    const jsonValue = JSON.stringify(data);

    try {
        await AsyncStorage.setItem("stats", jsonValue);
        console.log("Set statistics successfully!");
    } catch (error) {
        // saving error
        console.error(error);
    }
    console.log('updated the statistics with: ' + jsonValue);
};

/**Loads the statistics from AsyncStorage.
 *
 * @returns data the Promise of the statistics object*/
const getStatistics = async (): Promise<Stats> => {
    let data: Stats = []
    try {
        const jsonValue = await AsyncStorage.getItem("stats");
        if (jsonValue == null) {
            console.log("Statistics are empty!");
        } else {
            console.log("Retrieved statistics successfully!");
            data = JSON.parse(jsonValue);
        }
        console.log("Current statistics: " + jsonValue)
    } catch (error) {
        // error reading value
        console.error(error);
    }
    return data;
};

/**Resets the saved statistics, both in AsyncStorage and in the code.
 *
 * @param setStats dispatcher for statistics reset*/
const clearData = async (setStats: React.Dispatch<React.SetStateAction<Stats>>) => {
    try {
        setStats([])
        await AsyncStorage.removeItem('stats')
    } catch (e) {
        console.error(e)
    }
    console.log("Cleared statistics!")
}

//DONE Dictionary API integration (mandatory, 2pt)
//DONE Implement word fetching
//DONE Implement UI actions on fetched data

//queries Wordnik for a word
async function fetchWordData(word: string) {
    const url: string = "https://api.wordnik.com/v4/word.json/" + word.toLowerCase() + "/definitions?limit=200&includeRelated=false&sourceDictionaries=all&useCanonical=false&includeTags=false&api_key=" + WORDNIK_API_KEY;
    const response = await fetch(url);
    return await response.json();
}

//Queries Wordnik for the details of different words
async function fetchWords(gameAnswers: string[]): Promise<FetchedWord[]> {
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
        word: "Random",
        partOfSpeech: "undefined",
        definition: "undefined",
        example: null
    }
    let definitionIndex = 0, score = 0, maxScore = 0, maxScoreIndex = 0;
    console.log("Fetching word definition for " + theWord)
    const responseJson = await fetchWordData(theWord);
    while (responseJson[definitionIndex] != undefined) {
        score = 0;
        /*responseJson is a list of different definitions,
        * I chose to try and sort out the "best one" since many
        * of them are missing the definition and/or the examples.*/
        if (responseJson[definitionIndex].text != undefined) {
            score++;
        }
        if (responseJson[definitionIndex].partOfSpeech != undefined) {
            score++
        }
        if (responseJson[definitionIndex].example != undefined) {
            score++
        }
        if (score > maxScore) {
            maxScore = score;
            maxScoreIndex = definitionIndex;
        }
        //if one definition has all three necessary components, we quit searching
        if (maxScore == 3) {
            break;
        }

        definitionIndex++
    }
    //DONE parse out xml/html tags from text
    wordDetails.word = theWord;
    wordDetails.definition = responseJson[maxScoreIndex].text.replace("<(.*?)>", "");
    wordDetails.partOfSpeech = responseJson[maxScoreIndex].partOfSpeech;
    wordDetails.example = responseJson[maxScoreIndex].example;
    console.log("Word: " + wordDetails.word)
    console.log("PartOfSpeech: " + wordDetails.partOfSpeech)
    console.log("Definition: " + wordDetails.definition)
    console.log("Example: " + wordDetails.example)
    return wordDetails;
}

//DONE Challenges (2 pts)
//The user picks a word from the list of eligible words (or two, for Dordle).
//The application builds a Javascript object that represents the type of game to play and the word or words to guess (this depends on how your application works)
//This object is converted to a string url, and encoded as a QRCode, for instance using this package: https://www.npmjs.com/package/react-native-qrcode-svg
//The QR Code is displayed on screen, a second user can scan it with their phone camera
//This opens the application on the other phone, which receives the data, creates the game, and starts it
//DONE If the game is won, the user gets the option to issue a challenge back
const ChallengeSettings = ({isChallengeBack}: { isChallengeBack?: boolean }) => {
    const [challengeWords, setChallengeWords] = useState<string[]>([INIT]);
    const [challenge, addChallenge] = useState<string>("");
    const addGame = () => setChallengeWords([...challengeWords, INIT])
    const removeGame = () => setChallengeWords(challengeWords.slice(0, -1))
    const selectWord = (word: string, index: number) => {
        let newWords = [...challengeWords]
        newWords[index] = word
        setChallengeWords(newWords)
    }
    const setChallenge = () => {
        const gameAnswers: string[] = challengeWords.map(word => word === INIT ? INIT : word)
        const games: Wordle[] = gameAnswers.map(answer =>
            (
                {
                    guesses: [],
                    answer: answer,
                    words: [],
                    valid_words: [],
                    maxGuesses: maxAttempts(answer),
                    mode: "easy",
                    statistics: []
                }
            )
        )
        sendChallenge(JSON.stringify(games), addChallenge)


    }

    return (
        <Card style={styles.card}>
            <Text
                style={[styles.paragraph]}>{isChallengeBack ? "Challenge Back Your opponent" : "Challenge setup"}</Text>
            {challengeWords.map((word, index) => <WordleSettings init={INIT} gameIndex={index} list={answers}
                                                                 onSelect={selectWord} key={"game_" + index}/>)}
            <Button title="Add game" onPress={addGame}/>
            <Button title="Remove game" onPress={removeGame} disabled={challengeWords.length <= 1}/>
            {challenge == "" ?
                <Button title={isChallengeBack ? "Challenge back!" : "Challenge!"} onPress={setChallenge}/> :
                <Modal style={styles.modalView} animationType={"fade"} onRequestClose={() => addChallenge("")}>
                    <View style={styles.column}>
                        <View style={styles.centeredView}>
                            <SvgXml xml={challenge} width="90%" height="90%"/>
                            <Button title={"Back to the App"} onPress={() => addChallenge("")}/>
                        </View>

                    </View>
                </Modal>
            }
        </Card>
    )
}

//composes the url and converts it into a QRcode
function sendChallenge(wordles: string, setQR: React.Dispatch<React.SetStateAction<string>>) {

    const link = Linking.createURL("", {
        scheme: "wordle",
        queryParams: {wordles: wordles}
    })
    console.log(link)

    QRCode.toString(link, {type: 'svg' /* other options */})
        .then(setQR)
        .catch(() => {
            console.error('Unable to render SVG Code');
            // Do something with the error
        });
}

//parses the entry URL into a game that is then loaded
function receiveChallenge(url: string): Wordle[] | null {
    const parsedURL = Linking.parse(url);
    let challengeWordles: Wordle[] = []
    if (parsedURL.queryParams != null) {
        let challengeTmp: Wordle[] | null = null
        try {
            challengeTmp = JSON.parse(parsedURL.queryParams.wordles as string);
        } catch (e) {
            console.log(e)
        }
        if (challengeTmp == null) {
            return null
        }

        console.log("Loading challenge with words: " + JSON.stringify(challengeWordles))

        //needed because the received object does not hold the answer/valid words list
        challengeWordles = challengeTmp.map(wordle => ({
            guesses: wordle.guesses,
            answer: wordle.answer,
            words: answers,
            valid_words: allwords,
            maxGuesses: wordle.maxGuesses,
            mode: wordle.mode,
            statistics: wordle.statistics
        }))
    }
    return challengeWordles;
}

//DONE Advanced Dictionary integration (2 pts)
//The word to guess is either a random word of a minimum length of 5 (but can be longer) or the "Word of the day".
//If a random word has characters that are not on the keyboard (e.g., dashes, accented characters), then it is discarded and a new word is selected.
//The game supports words that are longer than 5 character.
//Longer words are allowed more guesses: the number of guesses is equal to the number of letters plus 1, with a maximum of 10 for a single word.
//In case a player is playing a Dordle game, the words can be smaller (e.g., a maximum of 7 or 8 characters is possible).
//Guesses are checked by wordnik: any word that has a definition is allowed.
// Guesses that are shorter than the word are allowed, if they are valid.

/**The function queries Wordnik for the definitions of a given word.
 * It returns true if the word does hold a valid definition at any point (since more definition objects may be returned)
 *
 * @param word the word too look for
 * @param games the games to preemptively check the word if it is an answer*/
async function wordnikValid(word: string, games?: Wordle[]): Promise<boolean> {

    //avoid computation if the word is an answer
    if(games?.find(game=> game.answer==word.toUpperCase())) return true;

    const request = "https://api.wordnik.com/v4/word.json/" + word.toLowerCase() + "/definitions?limit=200&includeRelated=false&sourceDictionaries=all&useCanonical=false&includeTags=false&api_key=" + WORDNIK_API_KEY
    const response = await fetch(request);
    const data = await response.json();
    let index = 0;
    while (data[index] != undefined) {
        if (data[index].text != undefined) {
            return true;
        }
        index++;
    }
    return false;
}

/**Queries Wordnik for a random word, returns null if it fails to retrieve a word.
 * Features a set of optional parameters to further customise the execution of the method.
 *
 * @param dordle if the game is a dordle, then uses custom maxLength
 * @param maxLength allows specification of a custom maximum length
 * @param minLength allows specification of a minimum word length, if undefined uses the constant MIN_LENGTH*/
async function wordnikRandom(dordle?: boolean, maxLength?: number, minLength?:number): Promise<string | null> {
    const maxlength = maxLength !== undefined ? maxLength : -1
    const minlength = minLength !==undefined? minLength: MIN_LENGTH
    const request: string = dordle&&maxLength===undefined?"https://api.wordnik.com/v4/words.json/randomWord?hasDictionaryDef=true&minLength=" + minlength + "&maxLength=" + MAX_DORDLE_LENGTH + "&api_key=" + WORDNIK_API_KEY:
        "https://api.wordnik.com/v4/words.json/randomWord?hasDictionaryDef=true&minLength=" + minlength + "&maxLength=" + maxlength + "&api_key=" + WORDNIK_API_KEY;

    const response = await fetch(request)
    const data = await response.json()
    console.log(request)
    if (data.message != undefined) {
        console.warn("API rate exceeded!")
        return null
    }
    if (data.word != undefined) {
        const reg = new RegExp("[a-zA-Z]+", 'g')
        reg.test(data.word)
        //DONE does not exclude words with hyphens
        if (data.word.length === reg.lastIndex) {//word does not contain invalid characters
            return data.word.toUpperCase()
        } else {//retry with a different word
            return wordnikRandom(dordle,maxLength,minLength)
        }
    } else {
        return null
    }
}

/**Queries wordnik for the WordOfTheDay of the given date.
 * It retrieves the response and eventually parses the data if the word
 * contains only text characters.
 *
 * @param date the date for selecting which Word of the day to use
 * @returns FetchedWord if the word is composed only of normal characters*/
//DONE fix date mismatch, disable button only on win/loss of the game
async function wordnikWordOfTheDay(date: string): Promise<FetchedWord | null> {
    let wordDetails: FetchedWord = {
        word: "",
        partOfSpeech: "",
        definition: "",
        example: null
    }
    const request = "https://api.wordnik.com/v4/words.json/wordOfTheDay?date=" + date + "&api_key=" + WORDNIK_API_KEY
    const response = await fetch(request)
    const data = await response.json()
    const reg = new RegExp("[a-zA-Z]+", 'g')
    reg.test(data.word)

    if (!reg.lastIndex===data.word.length) {//word does not contain illegal characters
        wordDetails.word = data.word;
        wordDetails.definition = data.definitions[0].text.replace("<(\w|\/)*>*", "")
        wordDetails.partOfSpeech = data.definitions[0].partOfSpeech
        if (data.examples[0] != undefined) {
            wordDetails.example = data.examples[0].text.replace(wordDetails.word, STRING_PLACEHOLDER)
        }
        return wordDetails;
    } else {
       return null;
    }
}

//TODO maybe store the word of the day, so that the user can back in and out without having to wait for querying wordnik?
const WordOfTheDay = ({onStart, wordDetails, setWOTDStatus}: {
    onStart: MultiWordleCallback,
    wordDetails: React.Dispatch<React.SetStateAction<FetchedWord[]>>,
    setWOTDStatus: React.Dispatch<React.SetStateAction<number>>
    }) => {
    const [todayDate, setTodayDate] = useState<string>("");
    const [playable, updatePlayableStatus] = useState<boolean>(false);
    useEffect(() => {
        let today = new Date();
        let date = today.getFullYear() + '-' + (today.getMonth() + 1) + '-' + today.getDate();
        checkDate(date).then()
        setTodayDate(date);
    }, []);
    const startTodayGame = () => {
        wordnikWordOfTheDay(todayDate).then(maybeWordDetails => {
            if (maybeWordDetails != null) {
                const game: Wordle = {
                    guesses: [],
                    answer: maybeWordDetails.word.toUpperCase(),
                    words: [],
                    valid_words: [],
                    maxGuesses: maxAttempts(maybeWordDetails.word),
                    mode: "easy",
                    statistics: []
                }
                setWOTDStatus(1);
                wordDetails([maybeWordDetails])
                onStart([game])

            } else {
                console.log("Word of the day details are null!")
            }
        }).catch(e => console.log("Error while reading the word of the day!" + e))
    }

    /*Checks whether the last saved date (in AsyncStorage) and today's date match or not.
    * If not then the user can attempt today's game, otherwise it means the user already played the game today.*/
    async function checkDate(todayDate: string) {
        let date = await getDate()

        if (date == null) {
            await setDate(todayDate)
            console.log("Saved today's date!")
            updatePlayableStatus(true)
        }
        if (date == todayDate) {
            console.log("Dates match, game already played!")
            updatePlayableStatus(false)
        } else {
            console.log("Dates do not match! Game can be played!")
            updatePlayableStatus(true)
        }
    }


    return (<Button title={"Word of the day"} disabled={!playable} onPress={startTodayGame}/>)
}


const getDate = async (): Promise<string | null> => {
    try {
        const jsonValue = await AsyncStorage.getItem("date");
        console.log("Current date: " + jsonValue)
        if (jsonValue == null) {
            console.log("Date is empty!");
            return null
        } else {
            console.log("Retrieved date successfully!");
            return jsonValue
        }

    } catch (e) {
        // error reading value
        console.error(e);
        return null
    }
};

const setDate = async (date: string) => {
    try {
        await AsyncStorage.setItem("date", date);
        console.log("Set date successfully!");
    } catch (e) {
        // saving error
        console.error(e);
    }
    console.log('updated the date with: ' + date);
}

//Queries Wordnik for a list of words and returns the composed wordle games
async function fetchRandomWords(words: string[]): Promise<Wordle[]> {
    let gameLength = 0;
    const gameAnswers = words
    while (gameAnswers.includes(INIT)) {
        const i = gameAnswers.findIndex(word => word === INIT)
        let randomWord = null
        if(gameLength==0){
            randomWord = await wordnikRandom(words.length==2)
            if(randomWord != null){
                gameLength = randomWord.length
                console.log("Game length set to "+randomWord.length)
            }
        } else {
            randomWord = await wordnikRandom(words.length==2, gameLength, gameLength)
            console.log("Querying wordnik for a word of length " +gameLength)
        }
        console.log("Random Word: " + randomWord)
        if (randomWord != null) {
            gameAnswers.splice(i, 1, randomWord)
        } else {
            gameAnswers.splice(i, 1, SAMPLE_WORD.word)
        }
    }

    console.log(gameAnswers.toString())

    return gameAnswers.map(answer =>
        (
            {
                guesses: [],
                answer: answer,
                words: answers,
                valid_words: allwords,
                maxGuesses: maxAttempts(answer),
                mode: "easy",
                statistics: []
            }
        )
    )

}

//computes the maximum number of attempts (10 is the maximum, otherwise it varies depending on word length)
function maxAttempts(answer: string): number {
    return answer.length + 1 > MAX_ATTEMPTS ? MAX_ATTEMPTS : answer.length + 1
}

function updateDate() {
    useEffect(() => {
        let today = new Date();
        let date = today.getFullYear() + '-' + (today.getMonth() + 1) + '-' + today.getDate();
        setDate(date).then()
    }, []);

}

//TODO Dordle: eternal edition (2 pts)
//This does not use additional APIs, but should be fun.
//This is a new game playing mode, that starts like Dordle.
//When a word in a dordle is completed, it is replaced by a new random word.
//TODO The user picks three of the existing guesses of the replaced word to "keep".
//The game resumes with the two remaining words. The game continues in this fashion until it is lost.
//The goal is to play for as long as possible.

const EternalSettings = ({onStart, wordleDetails,setEternalStatus}:{onStart:MultiWordleCallback,wordleDetails: React.Dispatch<React.SetStateAction<FetchedWord[]>>, setEternalStatus: React.Dispatch<React.SetStateAction<number>>}) => {
    const startEternal = () => {
        fetchRandomWords([INIT, INIT]).then(wordles => {
            fetchWords([wordles[0].answer,wordles[1].answer]).then(fetchedWords => {
                wordleDetails(fetchedWords)
                setEternalStatus(1)
                onStart(wordles)
            })
        }).catch(e=>console.log(e));

    }

    return (
        <Button title={"Dordle Eternal"} onPress={startEternal}/>
    )
}

const DordleEternalGame = ({onBack, wordDetails, startGames, eternalStatus, setEternalStatus}:{
    onBack: MultiWordleCallback,
    wordDetails: FetchedWord[],
    startGames: Wordle[],
    eternalStatus: number,
    setEternalStatus: React.Dispatch<React.SetStateAction<number>>}) =>{
    const [guess, setGuess] = useState<string>("");
    const [games, setGames] = useState<Wordle[]>(startGames);
    const [msgBox, updateMessage] = useState<string>("");
    const [details, setDetails] = useState<FetchedWord[]>(wordDetails);
    const [guessesToKeep, setGuessesToKeep] = useState<string[]>([]);
    const [gameLength, setGameLength] = useState<number>(games[0].answer.length);

    useEffect(()=>{
        console.log("Saved guesses:" +guessesToKeep.toString())
    },[guessesToKeep])

    useEffect(()=>{
        if(games.find(game=> status(game)==="win")!==undefined){
            setGameLength(findGameNotDone().answer.length)
            console.log("Need to replace a word!")
            setEternalStatus(2)//show the guess-keeping screen
        } else if(multiStatus(games)==="lost"){
            setEternalStatus(3)//game entirely lost, get back to main screen
        } else if(multiStatus(games)==="next"){
            console.log("Game can continue!")
            setEternalStatus(1)//game is ready to continue
        }
        console.log("Games have been updated!")
    },[games])

    let gameCount = 0;
    /*DONE Fix the ArrayOutOfBound Exception
    * Performs a check before appending a new letter,
    * if the letter to be appended would extend the guess over
    * the maximum length of a guess, it is logged in the console instead
    * and the last letter is not added.*/
    const enterValid = () => {
        wordnikValid(guess,games).then(isValid => {
            if (isValid) {
                setGames(games.map(game => status(game) === "next" ? ({...game, guesses: [...game.guesses, guess]}) : game))
                setGuess("")
            } else {
                updateMessage("The guess you entered is not valid!")
            }
        }).catch(e=>console.log(e))
    }, keyPress = (char: string) => {
        if (guess.length + 1 <= gameLength) {
            setGuess(guess + char)
        } else {
            console.log("User tried to enter one more character!")
        }
    }, backspace = () => setGuess(guess.slice(0, -1));

    function dordleNextWord(){
        wordnikRandom(true, gameLength, gameLength).then(word=>{
            if(word != null){
                let newGame: Wordle = {
                    answer: word,
                    maxGuesses: maxAttempts(word),
                    valid_words: [],
                    guesses: guessesToKeep,
                    words: [],
                    mode: "easy",
                    statistics: []
                }
                fetchCompleteWord(word).then(wordDetails=>{
                    if(status(games[0])==="win"){ //replace first word
                        setGames([newGame,games[1]])
                        setDetails([wordDetails,details[1]])
                    } else { //replace second word
                        setGames([games[0],newGame])
                        setDetails([details[0],wordDetails])
                    }
                }).catch(e=>console.log("Error while trying to fetch the random word details in Dordle Eternal! "+e))
            }
        }).catch(e=>console.log("Error while trying to fetch the next random word in Dordle Eternal! "+e))
    }

    const message = () => {
        let msg_to_display = ""
        switch (multiStatus(games)) {
            case "lost": {
                let lostWords = games.filter(game => status(game) === "lost").map(game => game.answer)
                msg_to_display = "You lasted "+gameCount+" Games! \n the missing words were: \n"
                lostWords.forEach(word => {
                    let definition = ""
                    details.forEach(wordDetail => {
                        if (wordDetail.word == word) {
                            definition = wordDetail.definition
                        }
                    })
                    msg_to_display += word + ": " + definition + "\n"
                })
                break;
            }
            default: {
                msg_to_display = msgBox
                break;
            }
        }
        return msg_to_display;
    }

    const [l, r] = games

    const displayClues = (desperate: boolean) => {
        let msg = ""
        if (desperate) {
            msg += "Desperate clues: \n"
            for (let i = 0; i < details.length; i++) {
                if (details[i].example != undefined) {
                    msg += "Word " + i + 1 + " :" + details[i].example?.replace(wordDetails[i].word, STRING_PLACEHOLDER) + "\n"
                } else {
                    console.log("Example for word " + i + " is unavailable!");
                }
            }
        } else {
            msg += "Clues: \n"
            for (let i = 0; i < details.length; i++) {
                if (details[i].partOfSpeech != undefined) {
                    msg += "Word " + i + 1 + " :" + details[i].partOfSpeech + "\n"
                } else {
                    console.log("Part of Speech for word " + i + " is unavailable!");
                }
            }
        }
        updateMessage(msg)
    }

    function findGameNotDone(): Wordle {
        if(status(games[0])!=="lost"||status(games[0])!=="win"){
            return games[0]
        } else {
            return games[1]
        }
    }

    const isSelected = (value: boolean) => {
        if( value){
            return  styles.correct
        } else {
            return styles.untried
        }
    }

    const selectGuessesToKeep = () => {
        const gameNotDone = findGameNotDone()
        gameCount++;

        //if the number of guesses is leq than 3, there is no need for the user to choose the guesses to keep (all are kept)
        if(gameNotDone.guesses.length<=GUESSES_TO_SAVE){
            console.log("Guess count is "+gameNotDone.guesses.length)
            setGuessesToKeep(gameNotDone.guesses)
            dordleNextWord()
        }

        interface SelectorCell {
            index: number,
            isSelected: boolean
        }
        const indexes: SelectorCell[] = Array(gameNotDone.guesses.length)
        for(let i = 0; i<indexes.length;i++){
            indexes[i] = {
                index : i,
                isSelected : false
            }
        }

        const cellPressed =(cell: SelectorCell) => {
            console.log("Pressed selector number: "+cell.index)
            cell.isSelected = !cell.isSelected;
        }

        let cell_count = 0;
        return(
            <View style={{flex:10}}>
                <Board game={gameNotDone} guess={guess}/>
                <Text style={styles.keyText}>Select which guess to save</Text>
                <View style={styles.row}>
                    {
                        indexes.map(cell =>
                            <Pressable style={[styles.boardCell, isSelected(cell.isSelected)]} onPress={() => cellPressed(cell)} key={"selector_cell_"+cell_count++}>
                                <Text style={styles.keyText} >{cell.index}</Text>
                            </Pressable>)
                    }
                </View>
                <Button title={"Save Guesses"} onPress={()=> saveGuessesToKeep(indexes.filter(cell=> cell.isSelected).map(cell=> cell.index))}/>
            </View>
        )
    }

    function saveGuessesToKeep(indexes: number[]){
        const gameNotLost = findGameNotDone()
        let savedGuesses: string[] = []
        indexes.forEach(idx=> {
            const guess = gameNotLost.guesses.at(idx)
            if(guess!== undefined){
                savedGuesses.push(guess)
            }
        })
        if(savedGuesses.length===GUESSES_TO_SAVE){
            setGuessesToKeep(savedGuesses)
            setGames(games)
        } else {
            console.log("Too Few Guesses selected!\nYou selected "+savedGuesses.length+
                " while you must select at least "+GUESSES_TO_SAVE)
        }
    }

    return (
        <View style={styles.container}>
            <Text style={styles.paragraph}>{gameName(games)}</Text>
            <Text style={styles.paragraph}>{message()}</Text>
            {eternalStatus==2?
                selectGuessesToKeep():
                <View>
                    <ScrollView>
                        <Card style={styles.card}>
                            <View style={styles.row}>
                                <View style={{flex: 10}}>
                                    <Board game={l} guess={guess} key={"l_game"}/>
                                </View>
                                <View style={{flex: 10}}>
                                    <Board game={r} guess={guess} key={"r_game"}/>
                                </View>
                            </View>
                        </Card>
                    </ScrollView>
                    <Card style={styles.card}>
                        <View style={[styles.row, styles.centered]}>
                            <Button title={"clue"} onPress={() => displayClues(false)}/>
                            <Button title={"Desperate clue"} onPress={() => displayClues(true)}
                                    disabled={disableDesperateClue(games,wordDetails)}/>
                        </View>
                        <KeyBoard games={games} valid={guess.length >= 5} empty={guess === ""} onPress={keyPress}
                                  onDelete={backspace}
                                  onEnter={enterValid}/>
                    </Card>
                </View>
            }
            <Button title="back" onPress={() => onBack(games)}/>
        </View>
    )
}

//TODO Checks whether there are examples available and if it is the last turn of the game
//TODO condition gets updated only upon clicking the clue button?
function disableDesperateClue(games: Wordle[], details: FetchedWord[]): boolean {
    let exampleAvailable = false;
    if(details!=undefined){
        if(details[0]!=undefined&&details[1]!=undefined){
            exampleAvailable = details[0].example != undefined && details[1] != undefined;
        }
    }
    const isLastTurn = games[0].guesses.length == games[0].maxGuesses&&games[1].guesses.length == games[1].maxGuesses
    return !exampleAvailable && !isLastTurn;
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
        flexDirection: "column",
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
    bordered: {borderColor: "black", borderWidth: 1},
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



