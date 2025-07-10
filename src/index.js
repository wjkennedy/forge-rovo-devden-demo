import api, { route } from '@forge/api';

/**
 * Fetches all labels from Jira using the REST API with pagination support
 * 
 * @description This function retrieves all available labels from the Jira instance
 * using pagination to handle large datasets. It processes results in batches 
 * of 50 items to ensure all labels are retrieved regardless of instance size.
 * 
 * @returns {Promise<Array>} Array of label objects from Jira
 * @throws {Error} When the API request fails or returns an error status
 * 
 * @example
 * const labels = await getLabels();
 * console.log(`Found ${labels.length} labels`);
 */
export const getLabels = async () => {
  console.log('[getLabels] Starting to fetch all labels from Jira');
  
  try {
    // Initialize variables for pagination and data collection
    var allLabels = [], total = 0, startAt = 0;
    const maxResults = 50; // Process labels in batches of 50
    
    console.debug('[getLabels] Making initial API request to get first page of labels');
    
    // Make initial request to get the first page of labels and total count
    const response = await api.asUser().requestJira(route`/rest/api/3/label?startAt=${startAt}&maxResults=${maxResults}`, {
      headers: {
        'Accept': 'application/json'
      }
    });

    console.debug(`[getLabels] API response status: ${response.status}`);
    
    // Check if the API request was successful
    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[getLabels] API request failed with status ${response.status}: ${errorBody}`);
      throw new Error(`Failed to fetch labels: ${response.status} - ${errorBody}`);
    }

    // Parse the JSON response and extract pagination info
    let data = await response.json();
    total = data.total;
    const isLast = data.isLast;
    const returnedMaxResults = data.maxResults;
    console.log(`[getLabels] Total labels available: ${total}`);
    console.debug(`[getLabels] First page isLast: ${isLast}, maxResults: ${returnedMaxResults}`);
    
    // Handle case where no labels exist
    if (total === 0) {
      console.warn('[getLabels] No labels found');
      return allLabels;
    }
    
    console.debug(`[getLabels] Starting pagination to fetch all ${total} labels`);
    
    // Process first page of data
    if (data.values && data.values.length > 0) {
      allLabels.push(...data.values);
      console.debug(`[getLabels] First page returned ${data.values.length} labels`);
    }
    
    // Continue fetching remaining pages based on API response indicators
    while (isLast === false || startAt + maxResults < total) {
      startAt += maxResults;
      console.debug(`[getLabels] Fetching next page (starting at index: ${startAt})`);
      
      // Fetch next page of labels
      const pageResponse = await api.asUser().requestJira(route`/rest/api/3/label?startAt=${startAt}&maxResults=${maxResults}`, {
        headers: {
          'Accept': 'application/json'
        }
      });
      
      // Check if the page request was successful
      if (!pageResponse.ok) {
        const errorBody = await pageResponse.text();
        console.error(`[getLabels] Page request failed with status ${pageResponse.status}: ${errorBody}`);
        throw new Error(`Failed to fetch labels page: ${pageResponse.status} - ${errorBody}`);
      }
      
      // Parse page response and extract pagination info
      data = await pageResponse.json();
      const currentIsLast = data.isLast;
      console.debug(`[getLabels] Current page returned ${data.values?.length || 0} labels, isLast: ${currentIsLast}`);
      
      // Add labels from current page to collection
      if (data.values && data.values.length > 0) {
        allLabels.push(...data.values);
      }
      
      // Log progress for large datasets
      console.debug(`[getLabels] Processed ${allLabels.length}/${total} labels so far`);
      
      // Break if we've reached the end based on API response
      if (currentIsLast === true || allLabels.length >= total) {
        break;
      }
    }
    
    // Log success metrics
    console.log(`[getLabels] Successfully fetched ${allLabels.length} labels`);
    console.debug('[getLabels] Label summary:', allLabels.map(label => label.name || label));
    
    // Return the complete labels array
    return allLabels;
  } catch (error) {
    // Log and re-throw any errors that occurred
    console.error('[getLabels] Error occurred while fetching labels:', error);
    throw error;
  }
}

/**
 * Creates a new Jira issue with the provided analysis data
 * 
 * @description This function creates a new task in the GOV project (ID: 10200) 
 * with issue type Task (ID: 10002). The issue description contains the analysis
 * data from the payload, formatted as an Atlassian Document Format (ADF) structure.
 * 
 * @param {Object} payload - The payload containing issue analysis data
 * @param {Object} payload.issueAnalysis - The analysis data to include in the issue description
 * @param {Object} context - Additional context information (currently logged but not used)
 * 
 * @returns {Promise<string>} The key of the newly created Jira issue (e.g., "GOV-123")
 * 
 * @throws {Error} When payload is missing, issueAnalysis is missing, or API request fails
 * 
 * @example
 * const payload = {
 *   issueAnalysis: "Found 5 redundant labels that can be merged"
 * };
 * const issueKey = await createJiraIssue(payload, context);
 * console.log(`Created issue: ${issueKey}`);
 */
export const createJiraIssue = async (payload, context) => {
  console.log('[createJiraIssue] Starting to create new Jira issue');
  
  try {
    // Validate required payload parameter
    if (!payload) {
      console.error('[createJiraIssue] No payload provided');
      throw new Error('Payload is required');
    }
    
    // Validate required issueAnalysis within payload
    if (!payload.issueAnalysis) {
      console.error('[createJiraIssue] No issueAnalysis in payload');
      throw new Error('issueAnalysis is required in payload');
    }

    // Log input parameters for debugging (remove sensitive data)
    const sanitizedPayload = { ...payload };
    delete sanitizedPayload.contextToken;
    console.debug("[createJiraIssue] Input payload:", JSON.stringify(sanitizedPayload, null, 2));
    console.debug("[createJiraIssue] Input context:", JSON.stringify(context, null, 2));

    // Extract relevant context information (if needed)
    const contextInfo = context?.info || {};
    console.debug("[createJiraIssue] Context information:", contextInfo);


    // Serialize the issue analysis for inclusion in the description
    const issueAnalysis = JSON.stringify(payload.issueAnalysis);
    console.debug("[createJiraIssue] Serialized issue analysis:", issueAnalysis);

    // Construct the request body using Atlassian Document Format (ADF)
    // This creates a task in the GOV project for one-atlas-tovb.atlassian.net
    var bodyData = `{
    "fields": {
        "description": {
            "type": "doc",
            "version": 1,
            "content": [
                {
                    "type": "paragraph",
                    "content": [
                        {
                            "type": "text",
                            "text": ${issueAnalysis}
                        }
                    ]
                }
            ]
        },
        "issuetype": {
            "id": "10002"
        },
        "project": {
            "id": "10200"
        },
        "summary": "Redundant labels cleanup. Thank you Rovo!"
    }
  }`;

    console.debug('[createJiraIssue] Request body data:', bodyData);
    console.log('[createJiraIssue] Making API request to create issue');

    // Make POST request to create the new issue
    const response = await api.asUser().requestJira(route`/rest/api/3/issue`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: bodyData
    });

    console.debug(`[createJiraIssue] API response status: ${response.status}`);

    // Handle successful issue creation
    if (response.ok) {
      console.log('[createJiraIssue] Issue created successfully');
      const newIssue = await response.json();
      console.debug("[createJiraIssue] API response data:", JSON.stringify(newIssue, null, 2));
      
      // Extract issue identifiers from response
      const issueKey = newIssue.key;  // e.g., "GOV-123"
      const issueId = newIssue.id;    // e.g., "10001"
      
      console.log(`[createJiraIssue] Successfully created issue with key: ${issueKey}, id: ${issueId}`);
      
      // Return the issue key for further reference
      return issueKey;
    } else {
      // Handle API error responses
      const errorBody = await response.text();
      console.error(`[createJiraIssue] API request failed with status ${response.status}`);
      console.error(`[createJiraIssue] Error response body: ${errorBody}`);
      console.error(`[createJiraIssue] Request body that caused error: ${bodyData}`);
      
      throw new Error(`Failed to create Jira issue: ${response.status} - ${errorBody}`);
    }
  } catch (error) {
    // Log comprehensive error information for debugging
    console.error('[createJiraIssue] Error occurred while creating issue:', error);
    console.error('[createJiraIssue] Error stack trace:', error.stack);
    throw error;
  }
}


/**
 * Fetches all custom fields from Jira with pagination support
 * 
 * @description This function retrieves all custom fields from the Jira instance
 * using pagination to handle large datasets. It processes results in batches 
 * of 50 items and maps them to a simplified format containing only name and id.
 * 
 * @returns {Promise<Array<Object>>} Array of objects with name and id properties
 * @returns {string} returns[].name - The display name of the custom field
 * @returns {string} returns[].id - The unique identifier of the custom field
 * 
 * @throws {Error} When any API request fails or returns an error status
 * 
 * @example
 * const customFields = await getCustomFields();
 * console.log(`Found ${customFields.length} custom fields`);
 * customFields.forEach(field => console.log(`${field.name}: ${field.id}`));
 */
export const getCustomFields = async () => {
  console.log('[getCustomFields] Starting to fetch all custom fields from Jira');
  
  try {
    // Initialize variables for pagination and data collection
    var mappedData = [], total = 0, startAt = 0;
    const maxResults = 50; // Process custom fields in batches of 50
    
    console.debug('[getCustomFields] Making initial API request to get first page of custom fields');
    
    // Make initial request to get the first page of custom fields and total count
    const response = await api.asUser().requestJira(route`/rest/api/3/field/search?type=custom&startAt=${startAt}&maxResults=${maxResults}`, {
      headers: {
        'Accept': 'application/json' 
      }
    });

    // Check if the initial API request was successful
    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[getCustomFields] Initial API request failed with status ${response.status}: ${errorBody}`);
      throw new Error(`Failed to fetch custom fields: ${response.status} - ${errorBody}`);
    }

    // Parse response and extract pagination info
    let result = await response.json();
    total = result.total;
    const isLast = result.isLast;
    const returnedMaxResults = result.maxResults;
    console.log(`[getCustomFields] Total custom fields available: ${total}`);
    console.debug(`[getCustomFields] First page isLast: ${isLast}, maxResults: ${returnedMaxResults}`);
    
    // Handle case where no custom fields exist
    if (total === 0) {
      console.warn('[getCustomFields] No custom fields found');
      return mappedData;
    }
    
    console.debug(`[getCustomFields] Starting pagination to fetch all ${total} custom fields`);
    
    // Process first page of data
    if (result.values && result.values.length > 0) {
      // Process each custom field in the first page
      for (var j = 0; j < result.values.length; j++) {
        const field = result.values[j];
        
        // Validate that field has required properties
        if (!field.name || !field.id) {
          console.warn(`[getCustomFields] Skipping field with missing name or id:`, field);
          continue;
        }
        
        // Map field to simplified format and add to collection
        mappedData.push({
          "name": field.name,
          "id": field.id
        });
      }
      console.debug(`[getCustomFields] First page returned ${result.values.length} custom fields`);
    }
    
    // Continue fetching remaining pages based on API response indicators
    while (isLast === false || startAt + maxResults < total) {
      startAt += maxResults;
      console.debug(`[getCustomFields] Fetching next page (starting at index: ${startAt})`);
      
      // Fetch next page of custom fields
      const pageResponse = await api.asUser().requestJira(route`/rest/api/3/field/search?type=custom&startAt=${startAt}&maxResults=${maxResults}`, {
        headers: {
          'Accept': 'application/json'
        }
      });
      
      // Check if the page request was successful
      if (!pageResponse.ok) {
        const errorBody = await pageResponse.text();
        console.error(`[getCustomFields] Page request failed with status ${pageResponse.status}: ${errorBody}`);
        throw new Error(`Failed to fetch custom fields page: ${pageResponse.status} - ${errorBody}`);
      }
      
      // Parse page response and extract pagination info
      result = await pageResponse.json();
      const currentIsLast = result.isLast;
      console.debug(`[getCustomFields] Current page returned ${result.values?.length || 0} custom fields, isLast: ${currentIsLast}`);
      
      // Process each custom field in the current page
      if (result.values && result.values.length > 0) {
        for (var k = 0; k < result.values.length; k++) {
          const field = result.values[k];
          
          // Validate that field has required properties
          if (!field.name || !field.id) {
            console.warn(`[getCustomFields] Skipping field with missing name or id:`, field);
            continue;
          }
          
          // Map field to simplified format and add to collection
          mappedData.push({
            "name": field.name,
            "id": field.id
          });
        }
      }
      
      // Log progress for large datasets
      console.debug(`[getCustomFields] Processed ${mappedData.length}/${total} custom fields so far`);
      
      // Break if we've reached the end based on API response
      if (currentIsLast === true || mappedData.length >= total) {
        break;
      }
    }
    
    // Log final metrics
    console.log(`[getCustomFields] Successfully fetched and mapped ${mappedData.length} custom fields`);
    console.debug(`[getCustomFields] Custom field summary:`, mappedData.map(f => ({ name: f.name, id: f.id })));

    return mappedData;
    
  } catch (error) {
    // Log and re-throw any errors that occurred during the process
    console.error('[getCustomFields] Error occurred while fetching custom fields:', error);
    throw error;
  }
}
