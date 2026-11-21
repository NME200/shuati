package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// CloudClient 通过云开发 HTTP API 访问文档型数据库
// 基础域名: https://{envId}.api.tcloudbasegateway.com
// 数据库路径: /v1/database/instances/(default)/databases/(default)/collections/{name}/documents
type CloudClient struct {
	baseURL string
	apiKey  string
	client  *http.Client
}

func NewCloudClient(envID, apiKey string) *CloudClient {
	return &CloudClient{
		baseURL: fmt.Sprintf("https://%s.api.tcloudbasegateway.com", envID),
		apiKey:  apiKey,
		client:  &http.Client{Timeout: 15 * time.Second},
	}
}

func (c *CloudClient) documentsURL(collection string) string {
	return c.baseURL + "/v1/database/instances/(default)/databases/(default)/collections/" +
		url.PathEscape(collection) + "/documents"
}

func (c *CloudClient) docURL(collection, docID string) string {
	return c.documentsURL(collection) + "/" + url.PathEscape(docID)
}

// do 发送带鉴权的请求并解析响应
func (c *CloudClient) do(method, url string, query url.Values, body interface{}) (map[string]interface{}, error) {
	var reader io.Reader
	if body != nil {
		data, err := json.Marshal(body)
		if err != nil {
			return nil, err
		}
		reader = bytes.NewReader(data)
	}

	fullURL := url
	if len(query) > 0 {
		fullURL = fullURL + "?" + query.Encode()
	}

	req, err := http.NewRequest(method, fullURL, reader)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("Accept", "application/json")
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var result map[string]interface{}
	if len(respBody) > 0 {
		if err := json.Unmarshal(respBody, &result); err != nil {
			return nil, fmt.Errorf("解析响应失败(%d): %s", resp.StatusCode, string(respBody))
		}
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		msg := ""
		if result != nil {
			if m, ok := result["message"].(string); ok {
				msg = m
			} else if m, ok := result["code"].(string); ok {
				msg = m
			}
		}
		return nil, fmt.Errorf("云开发 API 错误(%d): %s %s", resp.StatusCode, msg, string(respBody))
	}
	return result, nil
}

// Query 查询文档列表
// where 为普通 map，会转成 EJSON 查询字符串
func (c *CloudClient) Query(collection string, where map[string]interface{}, offset, limit int, orderJSON string) ([]map[string]interface{}, error) {
	q := url.Values{}
	q.Set("query", toEJSON(where))
	q.Set("offset", fmt.Sprintf("%d", offset))
	q.Set("limit", fmt.Sprintf("%d", limit))
	if orderJSON != "" {
		q.Set("order", orderJSON)
	}

	result, err := c.do("GET", c.documentsURL(collection), q, nil)
	if err != nil {
		return nil, err
	}

	list, _ := result["list"].([]interface{})
	out := make([]map[string]interface{}, 0, len(list))
	for _, item := range list {
		if m, ok := item.(map[string]interface{}); ok {
			out = append(out, fromEJSON(m))
		}
	}
	return out, nil
}

// Count 统计文档数量
func (c *CloudClient) Count(collection string, where map[string]interface{}) (int, error) {
	q := url.Values{}
	q.Set("query", toEJSON(where))
	q.Set("count", "true")

	result, err := c.do("GET", c.documentsURL(collection), q, nil)
	if err != nil {
		return 0, err
	}
	if v, ok := result["total"].(float64); ok {
		return int(v), nil
	}
	if v, ok := result["count"].(float64); ok {
		return int(v), nil
	}
	return 0, nil
}

// Delete 按 _id 删除文档
func (c *CloudClient) Delete(collection, docID string) error {
	_, err := c.do("DELETE", c.docURL(collection, docID), nil, nil)
	return err
}

// toEJSON 将普通 map 转为 EJSON 字符串
// 字符串值保持原样，数字/布尔保持原样
func toEJSON(where map[string]interface{}) string {
	if where == nil {
		return "{}"
	}
	data, err := json.Marshal(where)
	if err != nil {
		return "{}"
	}
	return string(data)
}

// fromEJSON 将 EJSON 文档转为普通 map，把 {"$oid":...} 等展开为字符串
func fromEJSON(m map[string]interface{}) map[string]interface{} {
	out := make(map[string]interface{}, len(m))
	for k, v := range m {
		out[k] = expandEJSONValue(v)
	}
	return out
}

func expandEJSONValue(v interface{}) interface{} {
	switch val := v.(type) {
	case map[string]interface{}:
		if oid, ok := val["$oid"].(string); ok && len(val) == 1 {
			return oid
		}
		if num, ok := val["$numberInt"].(string); ok && len(val) == 1 {
			return num
		}
		if num, ok := val["$numberDouble"].(string); ok && len(val) == 1 {
			return num
		}
		if d, ok := val["$date"].(string); ok && len(val) == 1 {
			return d
		}
		// 普通嵌套对象
		return fromEJSON(val)
	case []interface{}:
		for i, item := range val {
			val[i] = expandEJSONValue(item)
		}
		return val
	default:
		return v
	}
}

// isNotFound 判断错误是否为文档不存在
func isNotFound(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "404") || strings.Contains(msg, "not found") || strings.Contains(msg, "notexist")
}
