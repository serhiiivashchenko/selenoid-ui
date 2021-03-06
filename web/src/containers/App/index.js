import React, {Component} from "react";
import "./style.scss";
import Quota from "components/Quota";
import Queue from "components/Queue";
import Browsers from "components/Browsers";
import Status from "components/Status";
import {validate} from "jsonschema";
import {rxConnect} from "rx-connect";
import Rx from "rx";
import "rx-dom";

const schema = {
    "id": "/selenoid",
    "type": "object",
    "properties": {
        "total": {
            "type": "number"
        },
        "used": {
            "type": "number"
        },
        "queued": {
            "type": "number"
        },
        "pending": {
            "type": "number"
        },
        "browsers": {
            "id": "/browser",
            "type": "object",
            "patternProperties": {
                ".*": {
                    "id": "/version",
                    "type": "object",
                    "patternProperties": {
                        ".*": {
                            "id": "/quota",
                            "type": "object",
                            "patternProperties": {
                                ".*": {
                                    "type": "number",
                                },
                            },
                        },
                    },
                },
            },
        },
    },
    "required": [
        "total",
        "used",
        "pending",
        "queued",
        "browsers"
    ]
};

@rxConnect(() => {
    const open = new Rx.Subject();
    return Rx.Observable.merge(
        Rx.DOM.fromEventSource('/events', open)
            .map(event => JSON.parse(event))
            .map(event => {
                if (event.errors) {
                    return {
                        status: "error",
                        errors: event.errors
                    };
                }

                const validation = validate(event, schema);
                if (validation.valid) {
                    return {
                        status: "ok",
                        selenoid: event
                    };
                } else {
                    console.error("Wrong data from backend", validation.errors);
                    return {
                        status: "error",
                        errors: validation.errors
                    };
                }
            })
            .catch(error => {
                console.error('SSE Error', error);
                return Rx.Observable.just(
                    {
                        sse: "error",
                        status: "unknown"
                    }
                );
            }),
        open.map(event => ({
            sse: "ok"
        }))
    ).startWith({
        sse: "unknown",
        status: "unknown",
        selenoid: {
            "total": 0,
            "used": 0,
            "queued": 0,
            "pending": 0,
            "browsers": {}
        }
    });
})
export default class App extends Component {
    render() {
        const {sse, status, selenoid} = this.props;

        return (
            <div className="viewport">
                <div>
                    <Status status={sse} title="sse"/>
                    <Status status={status} title="selenoid"/>
                </div>
                <div className="stats">
                    <Quota total={selenoid.total} used={selenoid.used} pending={selenoid.pending}/>
                    <Queue queued={selenoid.queued}/>
                </div>
                <Browsers browsers={selenoid.browsers} totalUsed={selenoid.used}/>
            </div>
        );
    }
}
