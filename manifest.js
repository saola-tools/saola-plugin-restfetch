module.exports = {
  "config": {
    "validation": {
      "schema": {
        "type": "object",
        "properties": {
          "enabled": {
            "type": "boolean"
          },
          "ticketDeliveryDelay": {
            "type": "number"
          },
          "throughputQuota": {
            "type": "number"
          },
          "mappings": {
            "type": "object"
          },
          "mappingStore": {
            "type": "object",
            "patternProperties": {
              "^.+$": {
                "type": "string"
              }
            },
            "additionalProperties": false
          }
        },
        "additionalProperties": false
      }
    }
  }
};
