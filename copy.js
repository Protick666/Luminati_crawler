// Including the async module
const async = require('async');
const axios = require('axios');

// Creating an array for all elements execution
const tasks = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

async function dd(task, executed) {
    console.log("Currently Busy Processing Task " + task);
    // task = task[0]
    bind_url = "http://google.com";
    await axios.get(bind_url)
        .then(response => {
            //console.log(response.data);
            //console.log(response.data);
            console.log("Response from task " + task );
            executed(null, task);
        })
        .catch(error => {
            console.log(error);
            executed("Error", task);
        });
}

async function mama() {
    for (let i = 1; i <= 3; i++) {
        console.log("Starting " + i)
        // Initializing the queue
        // const queue = async.queue((task, executed) => {
        //     dd(task, executed)
        //
        // }, 10); // concurrency value = 1

        var queue = async.cargoQueue( function(task, executed){
            dd(task[0], executed);
        }, 100, 1);



// Adding each task from the tasks list
        tasks.forEach((task) => {
            let s_task = i * 10 + task
            queue.push(s_task, (error, task) => {
                if (error) {
                    console.log(`An error occurred while processing task ${task}`);
                } else {
                    console.log(`Finished processing task ${task}.`);
                }
            })

        });

// Executes the callback when the queue is done processing all the tasks
        queue.drain(() => {
            console.log('All items are succesfully processed !');
        })
        await queue.drain()
        console.log("Yes sir")
        console.log("Ending " + i)
    }
}

mama()

